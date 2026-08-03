import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { checkAvailability, findBestTableAssignment } from "@/domains/availability/availability-service";
import { HoldExpiredError, ReservationNotFoundError, SlotUnavailableError, TableCodeAlreadyUsedError, TableConflictError, TableInUseError, TableNotFoundError } from "@/domains/bookings/errors";
import { assertCustomerCanCancelReservation, assertCustomerCanModifyReservation } from "@/domains/bookings/customer-reservation-policy";
import { assertWaitlistTransition } from "@/domains/bookings/waitlist-state-machine";
import { assertTransition } from "@/domains/bookings/state-machine";
import { normalizeEmail, normalizePhone } from "@/domains/customers/normalization";
import { dateKeyInZone, formatTimeInZone } from "@/lib/datetime";
import { getInMemoryRestaurantSettings } from "@/domains/settings/settings-service";
import { createDemoReservations, createDemoWaitlist, demoCalls, demoCombinations, demoCustomers, demoServices, demoTables } from "@/repositories/demo-data";
import type { ConfirmedReservation, ConfirmHoldInput, CreateHoldInput, PublicReservation, ReservationRepository, TableChanges, TableInput, VoiceEscalationInput } from "@/repositories/repository";
import type { Customer, Reservation, ReservationEvent, ReservationHold, ServicePeriod, TableResource, VoiceCall, WaitlistEntry } from "@/types/domain";

interface MemoryState {
  reservations: Reservation[];
  holds: ReservationHold[];
  waitlist: WaitlistEntry[];
  customers: Customer[];
  calls: VoiceCall[];
  events: ReservationEvent[];
  idempotency: Map<string, ConfirmedReservation>;
  lock: Promise<void>;
}

const globalMemory = globalThis as typeof globalThis & { __sushiMemory?: MemoryState };

export function resetMemoryRepositoryForTests() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Memory repository reset is available only while running tests.");
  }
  delete globalMemory.__sushiMemory;
}

function state(): MemoryState {
  globalMemory.__sushiMemory ??= {
    reservations: createDemoReservations(),
    holds: [],
    waitlist: createDemoWaitlist(),
    customers: [...demoCustomers],
    calls: [...demoCalls],
    events: [],
    idempotency: new Map(),
    lock: Promise.resolve(),
  };
  return globalMemory.__sushiMemory;
}

function tokenHash(token: string) {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER ?? "demo-only-pepper";
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

function toPublic(reservation: Reservation): PublicReservation {
  const { managementTokenHash: _managementTokenHash, internalNotes: _internalNotes, ...safe } = reservation;
  void _managementTokenHash;
  void _internalNotes;
  return structuredClone(safe);
}

/**
 * In demo i tavoli erano una costante condivisa: modificarli da una sede li
 * cambiava anche all'altra. Qui ogni sede riceve la propria copia mutabile,
 * seminata dal demo set al primo accesso.
 */
const demoTablesByLocation = new Map<string, TableResource[]>();
/**
 * Riusa la sala che già ospita tavoli con questo orientamento: ogni sede ha
 * nomi propri e un tavolo nuovo non deve far nascere un doppione.
 */
function areaFor(tables: TableResource[], isOutdoor: boolean) {
  const esistente = tables.find((table) => table.isOutdoor === isOutdoor);
  if (esistente) return { id: esistente.diningAreaId, name: esistente.diningAreaName };
  return isOutdoor
    ? { id: "demo-area-outdoor", name: "Esterno" }
    : { id: "demo-area-indoor", name: "Sala interna" };
}

function tablesFor(locationId: string) {
  const existing = demoTablesByLocation.get(locationId);
  if (existing) return existing;
  const seeded = structuredClone(demoTables) as TableResource[];
  demoTablesByLocation.set(locationId, seeded);
  return seeded;
}

function context(locationId: string) {
  const memory = state();
  const settings = getInMemoryRestaurantSettings(locationId);
  const servicePeriods: ServicePeriod[] = settings.schedule.flatMap((day) => ([
    { name: "Pranzo", window: day.lunch, period: 1 },
    { name: "Cena", window: day.dinner, period: 2 },
  ]).map(({ name, window, period }) => ({
    id: `demo-${locationId}-${day.dayOfWeek}-${period}`,
    name,
    dayOfWeek: day.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    slotIntervalMinutes: settings.service.slotIntervalMinutes,
    defaultDurationMinutes: settings.durations.party3To4,
    turnaroundMinutes: settings.service.turnaroundMinutes,
    maximumCovers: name === "Pranzo" ? Math.max(1, Math.round(settings.service.maximumCovers * 0.88)) : settings.service.maximumCovers,
    maximumArrivalsPerSlot: settings.service.maximumArrivalsPerSlot,
    onlineBookingEnabled: settings.service.onlineBookingEnabled,
    phoneBookingEnabled: settings.service.phoneBookingEnabled,
    isActive: window.enabled,
  })));
  return {
    tables: tablesFor(locationId),
    combinations: demoCombinations,
    servicePeriods,
    reservations: memory.reservations.filter((reservation) => reservation.locationId === locationId),
    holds: memory.holds.filter((hold) => hold.locationId === locationId),
    closures: [],
    durationRules: settings.durations,
    bookingConstraints: {
      minimumPartySize: settings.rules.minimumPartySize,
      maximumPartySize: settings.rules.maximumPartySize,
      minimumNoticeMinutes: settings.policies.minimumNoticeMinutes,
      maximumAdvanceDays: settings.policies.maximumAdvanceDays,
      requiresManualApproval: settings.rules.requiresManualApproval || settings.operations.serviceMode === "approval",
      requiresDeposit: settings.rules.requiresDeposit,
      depositAmount: settings.rules.depositAmount,
    },
    locationAvailable: settings.operations.serviceMode !== "paused",
    timezone: getRestaurantLocationById(locationId)?.timezone ?? restaurantConfig.timezone,
    now: new Date(),
  };
}

async function withLock<T>(operation: () => Promise<T> | T): Promise<T> {
  const memory = state();
  const previous = memory.lock;
  let release: () => void = () => undefined;
  memory.lock = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function event(reservationId: string, eventType: string, source: string, previousData?: Partial<Reservation>, newData?: Partial<Reservation>) {
  state().events.unshift({ id: randomUUID(), reservationId, eventType, source, actorType: source === "web" ? "customer" : "staff", previousData, newData, createdAt: new Date().toISOString() });
}

export class MemoryReservationRepository implements ReservationRepository {
  constructor(private readonly locationId: string = restaurantConfig.locationId) {}

  async getAvailabilityContext() { return context(this.locationId); }

  async listTables() { return structuredClone(tablesFor(this.locationId)); }

  async createTable(input: TableInput): Promise<TableResource> {
    const tables = tablesFor(this.locationId);
    if (tables.some((table) => table.code === input.code)) throw new TableCodeAlreadyUsedError(input.code);
    const index = tables.filter((table) => table.isOutdoor === input.isOutdoor).length;
    const area = areaFor(tables, input.isOutdoor);
    const created: TableResource = {
      id: `demo-table-${randomUUID()}`,
      code: input.code,
      displayName: input.displayName,
      diningAreaId: area.id,
      diningAreaName: area.name,
      minimumCapacity: input.minimumCapacity,
      maximumCapacity: input.maximumCapacity,
      shape: "round",
      positionX: 12 + (index % 5) * 18,
      positionY: 14 + Math.floor(index / 5) * 20,
      width: 80,
      height: 80,
      isAccessible: input.isAccessible,
      isOutdoor: input.isOutdoor,
      isStrategic: false,
      status: "available",
    };
    tables.push(created);
    return structuredClone(created);
  }

  async updateTable(id: string, changes: TableChanges): Promise<TableResource> {
    const tables = tablesFor(this.locationId);
    const current = tables.find((table) => table.id === id);
    if (!current) throw new TableNotFoundError();
    if (changes.code && changes.code !== current.code && tables.some((table) => table.code === changes.code)) {
      throw new TableCodeAlreadyUsedError(changes.code);
    }
    const isOutdoor = changes.isOutdoor ?? current.isOutdoor;
    const area = isOutdoor === current.isOutdoor
      ? { id: current.diningAreaId, name: current.diningAreaName }
      : areaFor(tables.filter((table) => table.id !== id), isOutdoor);
    Object.assign(current, {
      code: changes.code ?? current.code,
      displayName: changes.displayName ?? current.displayName,
      minimumCapacity: changes.minimumCapacity ?? current.minimumCapacity,
      maximumCapacity: changes.maximumCapacity ?? current.maximumCapacity,
      isAccessible: changes.isAccessible ?? current.isAccessible,
      status: changes.status ?? current.status,
      isOutdoor,
      diningAreaId: area.id,
      diningAreaName: area.name,
    });
    return structuredClone(current);
  }

  async deleteTable(id: string): Promise<void> {
    const tables = tablesFor(this.locationId);
    const index = tables.findIndex((table) => table.id === id);
    if (index < 0) throw new TableNotFoundError();
    const blocking = state().reservations.some((reservation) =>
      reservation.locationId === this.locationId
      && reservation.tableIds.includes(id)
      && ["confirmed", "modified", "arriving", "late", "arrived", "seated"].includes(reservation.status));
    if (blocking) throw new TableInUseError();
    tables.splice(index, 1);
  }

  async createHold(input: CreateHoldInput) {
    return withLock(() => {
      const current = context(this.locationId);
      const availability = checkAvailability({ ...input.availability, requestedTime: formatTimeInZone(input.startAt) }, current);
      const option = availability.availableOptions.find((item) => item.startAt === input.startAt);
      if (!option) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
      const now = new Date();
      const hold: ReservationHold = {
        id: randomUUID(),
        locationId: this.locationId,
        sessionId: input.sessionId,
        partySize: input.availability.partySize,
        startAt: option.startAt,
        endAt: option.endAt,
        tableIds: option.tableIds,
        combinationId: option.combinationId,
        diningAreaId: option.diningArea.id,
        expiresAt: new Date(now.getTime() + restaurantConfig.holdMinutes * 60_000).toISOString(),
        status: "active",
        createdAt: now.toISOString(),
      };
      state().holds.push(hold);
      return structuredClone(hold);
    });
  }

  async releaseHold(holdId: string, sessionId?: string) {
    const hold = state().holds.find((item) => item.id === holdId && item.locationId === this.locationId && (!sessionId || item.sessionId === sessionId));
    if (hold && hold.status === "active") hold.status = "released";
  }

  async confirmHold(input: ConfirmHoldInput) {
    return withLock(() => {
      const memory = state();
      const idempotencyKey = `${this.locationId}:${input.idempotencyKey}`;
      const previousResult = memory.idempotency.get(idempotencyKey);
      if (previousResult) return structuredClone(previousResult);
      const hold = memory.holds.find((item) => item.id === input.holdId);
      if (!hold || hold.locationId !== this.locationId || hold.status !== "active" || new Date(hold.expiresAt).getTime() <= Date.now()) throw new HoldExpiredError();
      const assignment = findBestTableAssignment({ partySize: hold.partySize, preferredAreaId: hold.diningAreaId }, context(hold.locationId), hold.startAt, hold.endAt, hold.id);
      if (!assignment || assignment.tableIds.some((id) => !hold.tableIds.includes(id))) throw new SlotUnavailableError();

      const existingCustomer = memory.customers.find((item) => normalizePhone(item.phone) === normalizePhone(input.customer.phone) || (item.email && input.customer.email && normalizeEmail(item.email) === normalizeEmail(input.customer.email)));
      const customer: Customer = existingCustomer ?? {
        id: randomUUID(),
        ...input.customer,
        phone: normalizePhone(input.customer.phone),
        email: input.customer.email ? normalizeEmail(input.customer.email) : undefined,
        customerType: "new",
        totalBookings: 0,
        noShowCount: 0,
      };
      if (existingCustomer) {
        customer.firstName = input.customer.firstName;
        customer.lastName = input.customer.lastName;
        customer.phone = normalizePhone(input.customer.phone);
        customer.email = input.customer.email ? normalizeEmail(input.customer.email) : customer.email;
        customer.preferredLanguage = input.customer.preferredLanguage;
        customer.privacyConsent = true;
        customer.marketingConsent = customer.marketingConsent || input.customer.marketingConsent;
        customer.allergies = input.customer.allergies ?? customer.allergies;
        customer.accessibilityNeeds = input.customer.accessibilityNeeds ?? customer.accessibilityNeeds;
      }
      customer.totalBookings += 1;
      if (customer.customerType === "new" && customer.totalBookings >= 2) customer.customerType = "regular";
      if (customer.customerType === "regular" && customer.totalBookings >= 10) customer.customerType = "loyal";
      if (!existingCustomer) memory.customers.push(customer);
      const managementToken = randomBytes(32).toString("base64url");
      const createdAt = new Date().toISOString();
      const reservation: Reservation = {
        id: randomUUID(),
        organizationId: restaurantConfig.organizationId,
        restaurantId: getRestaurantLocationById(hold.locationId)?.restaurantId ?? restaurantConfig.id,
        locationId: hold.locationId,
        customerId: customer.id,
        servicePeriodId: demoServices.find((service) => formatTimeInZone(hold.startAt) >= service.startTime && formatTimeInZone(hold.startAt) < service.endTime)?.id ?? demoServices[0].id,
        reservationCode: `${getRestaurantLocationById(hold.locationId)?.reservationCodePrefix ?? "RS"}-${String(memory.reservations.length + 2401).padStart(4, "0")}`,
        managementTokenHash: tokenHash(managementToken),
        source: "web",
        status: "confirmed",
        partySize: hold.partySize,
        reservationDate: dateKeyInZone(hold.startAt),
        startAt: hold.startAt,
        endAt: hold.endAt,
        durationMinutes: Math.round((new Date(hold.endAt).getTime() - new Date(hold.startAt).getTime()) / 60_000) - 15,
        diningAreaId: hold.diningAreaId,
        tableIds: hold.tableIds,
        combinationId: hold.combinationId,
        customer,
        customerNotes: input.customerNotes,
        specialOccasion: input.specialOccasion,
        language: customer.preferredLanguage,
        createdAt,
        updatedAt: createdAt,
      };
      hold.status = "converted";
      memory.reservations.push(reservation);
      event(reservation.id, "reservation_confirmed", "web", undefined, reservation);
      const result = { reservation: toPublic(reservation), managementToken };
      memory.idempotency.set(idempotencyKey, result);
      return structuredClone(result);
    });
  }

  async listReservations() {
    return state().reservations.filter((item) => item.locationId === this.locationId).map(toPublic).sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  async findReservationByToken(token: string) {
    const found = state().reservations.find((item) => item.locationId === this.locationId && item.managementTokenHash === tokenHash(token));
    return found ? toPublic(found) : null;
  }

  async updateReservationByToken(token: string, changes: Partial<Reservation>) {
    return withLock(() => {
      const reservation = state().reservations.find((item) => item.locationId === this.locationId && item.managementTokenHash === tokenHash(token));
      if (!reservation) throw new ReservationNotFoundError();
      assertCustomerCanModifyReservation(reservation);
      const before = structuredClone(reservation);
      const requiresAvailabilityCheck = changes.partySize !== undefined || changes.startAt !== undefined || changes.durationMinutes !== undefined;
      if (requiresAvailabilityCheck) {
        const targetStart = changes.startAt ?? reservation.startAt;
        const targetPartySize = changes.partySize ?? reservation.partySize;
        const currentContext = context(reservation.locationId);
        currentContext.reservations = currentContext.reservations.filter((item) => item.id !== reservation.id);
        const availability = checkAvailability({
          locationId: reservation.locationId,
          date: targetStart.slice(0, 10),
          requestedTime: formatTimeInZone(targetStart),
          partySize: targetPartySize,
          preferredAreaId: reservation.diningAreaId,
          requestedDuration: changes.durationMinutes,
          source: "web",
        }, currentContext);
        const option = availability.availableOptions.find((item) => item.startAt === targetStart);
        if (!option) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
        changes.endAt = option.endAt;
        changes.durationMinutes = option.durationMinutes;
        changes.tableIds = option.tableIds;
        changes.combinationId = option.combinationId;
        changes.diningAreaId = option.diningArea.id;
        changes.reservationDate = dateKeyInZone(targetStart);
      }
      if (changes.customer) {
        const customer = state().customers.find((item) => item.id === reservation.customerId);
        if (customer) Object.assign(customer, changes.customer);
        changes.customer = customer ?? changes.customer;
      }
      Object.assign(reservation, changes, { status: requiresAvailabilityCheck && reservation.status === "confirmed" ? "modified" : reservation.status, updatedAt: new Date().toISOString() });
      event(reservation.id, requiresAvailabilityCheck ? "reservation_modified" : "reservation_details_updated", "web", before, reservation);
      return toPublic(reservation);
    });
  }

  async cancelReservationByToken(token: string, reason?: string) {
    return withLock(() => {
      const reservation = state().reservations.find((item) => item.locationId === this.locationId && item.managementTokenHash === tokenHash(token));
      if (!reservation) throw new ReservationNotFoundError();
      assertCustomerCanCancelReservation(reservation);
      assertTransition(reservation.status, "cancelled_by_customer");
      const before = structuredClone(reservation);
      reservation.status = "cancelled_by_customer";
      reservation.customerNotes = [reservation.customerNotes, reason].filter(Boolean).join(" Â· ");
      reservation.updatedAt = new Date().toISOString();
      event(reservation.id, "reservation_cancelled", "web", before, reservation);
      return toPublic(reservation);
    });
  }

  async updateReservationByStaff(id: string, changes: { status?: Reservation["status"]; tableIds?: string[]; customerNotes?: string }) {
    return withLock(() => {
      const reservation = state().reservations.find((item) => item.id === id);
      if (!reservation) throw new ReservationNotFoundError();
      const before = structuredClone(reservation);
      if (changes.status && changes.status !== reservation.status) assertTransition(reservation.status, changes.status);
      if (changes.tableIds) {
        const occupied = state().reservations.some((item) => item.id !== reservation.id && item.tableIds.some((tableId) => changes.tableIds?.includes(tableId)) && ["confirmed", "modified", "arriving", "late", "arrived", "seated"].includes(item.status) && new Date(item.startAt) < new Date(reservation.endAt) && new Date(reservation.startAt) < new Date(item.endAt));
        if (occupied) throw new TableConflictError();
        reservation.tableIds = changes.tableIds;
      }
      if (changes.status) reservation.status = changes.status;
      if (changes.customerNotes !== undefined) reservation.customerNotes = changes.customerNotes;
      reservation.updatedAt = new Date().toISOString();
      event(reservation.id, "reservation_updated_by_staff", "admin", before, reservation);
      return toPublic(reservation);
    });
  }

  async addWaitlist(entry: Omit<WaitlistEntry, "id" | "locationId" | "status" | "priority" | "createdAt">) {
    const row: WaitlistEntry = { ...entry, id: randomUUID(), locationId: this.locationId, status: "waiting", priority: 0, createdAt: new Date().toISOString() };
    state().waitlist.push(row);
    return structuredClone(row);
  }
  async updateWaitlist(id: string, status: WaitlistEntry["status"]) { const row = state().waitlist.find((item) => item.id === id && item.locationId === this.locationId); if (!row) throw new ReservationNotFoundError(); if (row.status !== status) assertWaitlistTransition(row.status, status); row.status = status; return structuredClone(row); }
  async listWaitlist() { return structuredClone(state().waitlist.filter((item) => item.locationId === this.locationId)); }
  async listCustomers() {
    const customerIds = new Set(state().reservations.filter((reservation) => reservation.locationId === this.locationId).map((reservation) => reservation.customerId));
    return structuredClone(state().customers.filter((customer) => customerIds.has(customer.id)));
  }
  async recordVoiceEscalation(input: VoiceEscalationInput) {
    return withLock(() => {
      const relatedCallId = input.providerCallId?.trim();
      const providerCallId = relatedCallId ? `escalation:${relatedCallId}` : `escalation:${randomUUID()}`;
      const now = new Date().toISOString();
      const next: VoiceCall = {
        id: randomUUID(),
        locationId: this.locationId,
        provider: "retell",
        providerCallId,
        callerPhone: input.callerPhone ?? "",
        startedAt: now,
        durationSeconds: 0,
        status: "callback_requested",
        intent: "Escalation al personale",
        outcome: "Richiamata richiesta",
        summary: input.summary,
        sentiment: "neutral",
        reservationId: input.reservationId,
        humanEscalationRequired: true,
      };
      const existing = state().calls.find((call) => call.locationId === this.locationId && call.provider === "retell" && call.providerCallId === providerCallId);
      if (existing) {
        Object.assign(existing, next, { id: existing.id, startedAt: existing.startedAt });
        return structuredClone(existing);
      }
      state().calls.unshift(next);
      return structuredClone(next);
    });
  }
  async listCalls() { return structuredClone(state().calls.filter((call) => call.locationId === this.locationId).sort((a, b) => b.startedAt.localeCompare(a.startedAt))); }
  async listEvents() {
    const reservationIds = new Set(state().reservations.filter((reservation) => reservation.locationId === this.locationId).map((reservation) => reservation.id));
    return structuredClone(state().events.filter((row) => reservationIds.has(row.reservationId)));
  }
}
