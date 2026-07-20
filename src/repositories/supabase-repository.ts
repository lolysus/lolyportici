import "server-only";

import { randomUUID } from "node:crypto";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { checkAvailability } from "@/domains/availability/availability-service";
import { assertCustomerCanCancelReservation, assertCustomerCanModifyReservation } from "@/domains/bookings/customer-reservation-policy";
import { assertWaitlistTransition } from "@/domains/bookings/waitlist-state-machine";
import { CapacityExceededError, HoldExpiredError, ReservationNotFoundError, SlotUnavailableError, TableConflictError } from "@/domains/bookings/errors";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hashManagementToken, managementTokenForIdempotency } from "@/lib/security";
import { formatTimeInZone } from "@/lib/datetime";
import type { ConfirmedReservation, ConfirmHoldInput, CreateHoldInput, PublicReservation, ReservationRepository, VoiceEscalationInput } from "@/repositories/repository";
import type { Customer, Reservation, ReservationEvent, ReservationHold, ServicePeriod, SpecialClosure, TableCombination, TableResource, VoiceCall, WaitlistEntry } from "@/types/domain";

type Row = Record<string, unknown>;

function asString(value: unknown, fallback = "") { return typeof value === "string" ? value : fallback; }
function asNumber(value: unknown, fallback = 0) { return typeof value === "number" ? value : Number(value ?? fallback); }
function asBoolean(value: unknown) { return value === true; }
function asRows(value: unknown): Row[] { return Array.isArray(value) ? value.filter((row): row is Row => Boolean(row) && typeof row === "object") : []; }

function mapCustomer(row: Row): Customer {
  return {
    id: asString(row.id), firstName: asString(row.first_name), lastName: asString(row.last_name), phone: asString(row.phone),
    email: asString(row.email) || undefined, preferredLanguage: asString(row.preferred_language, "it"),
    marketingConsent: asBoolean(row.marketing_consent), privacyConsent: asBoolean(row.privacy_consent),
    customerType: asString(row.customer_type, "new") as Customer["customerType"], totalBookings: asNumber(row.total_bookings),
    noShowCount: asNumber(row.no_show_count), lastVisitAt: asString(row.last_visit_at) || undefined,
    allergies: asString(row.allergies) || undefined, accessibilityNeeds: asString(row.accessibility_needs) || undefined,
  };
}

function mapReservation(row: Row): Reservation {
  const customerRow = Array.isArray(row.customers) ? asRows(row.customers)[0] : (row.customers as Row | undefined);
  const customer = customerRow ? mapCustomer(customerRow) : mapCustomer({ id: row.customer_id });
  const assignmentRows = asRows(row.reservation_table_assignments);
  return {
    id: asString(row.id), organizationId: asString(row.organization_id), restaurantId: asString(row.restaurant_id), locationId: asString(row.location_id),
    customerId: asString(row.customer_id), servicePeriodId: asString(row.service_period_id), reservationCode: asString(row.reservation_code),
    managementTokenHash: asString(row.management_token_hash), source: asString(row.source) as Reservation["source"], status: asString(row.status) as Reservation["status"],
    partySize: asNumber(row.party_size), reservationDate: asString(row.reservation_date), startAt: asString(row.start_at), endAt: asString(row.end_at),
    durationMinutes: asNumber(row.duration_minutes), diningAreaId: asString(row.dining_area_preference_id) || undefined,
    tableIds: assignmentRows.map((item) => asString(item.table_id)).filter(Boolean), combinationId: asString(row.assigned_combination_id) || undefined,
    customer, customerNotes: asString(row.customer_notes) || undefined, internalNotes: asString(row.internal_notes) || undefined,
    specialOccasion: asString(row.special_occasion) || undefined, language: asString(row.language, "it"),
    createdAt: asString(row.created_at), updatedAt: asString(row.updated_at),
  };
}

function toPublic(reservation: Reservation): PublicReservation {
  const { managementTokenHash: _token, internalNotes: _notes, ...safe } = reservation;
  void _token; void _notes;
  return safe;
}

function mapVoiceCall(row: Row): VoiceCall {
  const summary = row.summary as Row | string | undefined;
  return {
    id: asString(row.id),
    locationId: asString(row.location_id),
    provider: asString(row.provider) as VoiceCall["provider"],
    providerCallId: asString(row.provider_call_id),
    callerPhone: asString(row.caller_phone),
    startedAt: asString(row.started_at),
    durationSeconds: asNumber(row.duration_seconds),
    status: asString(row.status) as VoiceCall["status"],
    intent: asString(row.intent),
    outcome: asString(row.outcome),
    summary: typeof summary === "string" ? summary : asString(summary?.text ?? summary?.summary),
    sentiment: asString(row.sentiment, "neutral") as VoiceCall["sentiment"],
    reservationId: asString(row.reservation_id) || undefined,
    humanEscalationRequired: asBoolean(row.human_escalation_required),
  };
}

const reservationSelect = "*,customers(*),reservation_table_assignments(table_id,start_at,end_at)";

export class SupabaseReservationRepository implements ReservationRepository {
  constructor(private readonly locationId: string = restaurantConfig.locationId) {}

  async getAvailabilityContext() {
    const db = getSupabaseAdmin();
    const [locationResult, tablesResult, combinationsResult, combinationItemsResult, servicesResult, reservationsResult, holdsResult, closuresResult, rulesResult] = await Promise.all([
      db.from("locations").select("booking_enabled,status,restaurants(status)").eq("id", this.locationId).maybeSingle(),
      db.from("restaurant_tables").select("*,dining_areas(name)").eq("location_id", this.locationId).eq("is_active", true),
      db.from("table_combinations").select("*").eq("location_id", this.locationId).eq("is_active", true),
      db.from("table_combination_items").select("*"),
      db.from("service_periods").select("*").eq("location_id", this.locationId).eq("is_active", true),
      db.from("reservations").select(reservationSelect).eq("location_id", this.locationId).in("status", ["confirmed", "modified", "arriving", "late", "arrived", "seated"]),
      db.from("reservation_holds").select("*").eq("location_id", this.locationId).eq("status", "active"),
      db.from("special_openings_closures").select("*").eq("location_id", this.locationId),
      db.from("booking_rules").select("minimum_party_size,maximum_party_size,minimum_notice_minutes,maximum_advance_days,requires_manual_approval,requires_deposit,deposit_amount,conditions").eq("location_id", this.locationId).eq("is_active", true).order("created_at").limit(1).maybeSingle(),
    ]);
    const firstError = [locationResult.error, tablesResult.error, combinationsResult.error, combinationItemsResult.error, servicesResult.error, reservationsResult.error, holdsResult.error, closuresResult.error, rulesResult.error].find(Boolean);
    if (firstError) throw firstError;
    const tableRows = (tablesResult.data ?? []) as Row[];
    const tables: TableResource[] = tableRows.map((row) => ({
      id: asString(row.id), code: asString(row.code), displayName: asString(row.display_name), diningAreaId: asString(row.dining_area_id),
      diningAreaName: asString((row.dining_areas as Row | undefined)?.name, "Sala"), minimumCapacity: asNumber(row.minimum_capacity), maximumCapacity: asNumber(row.maximum_capacity),
      shape: asString(row.shape) as TableResource["shape"], positionX: asNumber(row.position_x), positionY: asNumber(row.position_y), width: asNumber(row.width, 80), height: asNumber(row.height, 80),
      isAccessible: asBoolean(row.is_accessible), isOutdoor: asBoolean(row.is_outdoor), isStrategic: asBoolean(row.is_strategic), status: asString(row.status, "available") as TableResource["status"],
    }));
    const itemRows = (combinationItemsResult.data ?? []) as Row[];
    const combinations: TableCombination[] = ((combinationsResult.data ?? []) as Row[]).map((row) => ({
      id: asString(row.id), name: asString(row.name), minimumCapacity: asNumber(row.minimum_capacity), maximumCapacity: asNumber(row.maximum_capacity), isActive: asBoolean(row.is_active),
      tableIds: itemRows.filter((item) => item.table_combination_id === row.id).map((item) => asString(item.table_id)),
    }));
    const servicePeriods: ServicePeriod[] = ((servicesResult.data ?? []) as Row[]).map((row) => ({
      id: asString(row.id), name: asString(row.name), dayOfWeek: asNumber(row.day_of_week), startTime: asString(row.start_time).slice(0, 5), endTime: asString(row.end_time).slice(0, 5),
      slotIntervalMinutes: asNumber(row.slot_interval_minutes), defaultDurationMinutes: asNumber(row.default_duration_minutes), turnaroundMinutes: asNumber(row.turnaround_minutes),
      maximumCovers: asNumber(row.maximum_covers), maximumArrivalsPerSlot: asNumber(row.maximum_arrivals_per_slot), onlineBookingEnabled: asBoolean(row.online_booking_enabled), phoneBookingEnabled: asBoolean(row.phone_booking_enabled), isActive: asBoolean(row.is_active),
    }));
    const reservations = ((reservationsResult.data ?? []) as Row[]).map(mapReservation);
    const holds: ReservationHold[] = ((holdsResult.data ?? []) as Row[]).map((row) => ({
      id: asString(row.id), locationId: asString(row.location_id), sessionId: asString(row.session_id), partySize: asNumber(row.party_size), startAt: asString(row.start_at), endAt: asString(row.end_at),
      tableIds: Array.isArray(row.table_ids) ? row.table_ids.map(String) : [], combinationId: asString(row.combination_id) || undefined, diningAreaId: asString(row.dining_area_id), expiresAt: asString(row.expires_at), status: asString(row.status) as ReservationHold["status"], createdAt: asString(row.created_at),
    }));
    const closures: SpecialClosure[] = ((closuresResult.data ?? []) as Row[]).map((row) => ({
      id: asString(row.id), date: asString(row.date), startTime: asString(row.start_time).slice(0, 5) || undefined, endTime: asString(row.end_time).slice(0, 5) || undefined,
      type: asString(row.type) as SpecialClosure["type"], reason: asString(row.reason), affectedAreaId: asString(row.affected_area_id) || undefined, affectedTableId: asString(row.affected_table_id) || undefined,
    }));
    const rule = rulesResult.data;
    const conditions = (rule?.conditions ?? {}) as { durationByParty?: { party1To2: number; party3To4: number; party5To6: number; party7To10: number } };
    const restaurant = Array.isArray(locationResult.data?.restaurants) ? locationResult.data.restaurants[0] : locationResult.data?.restaurants;
    return {
      tables, combinations, servicePeriods, reservations, holds, closures,
      durationRules: conditions.durationByParty,
      bookingConstraints: rule ? {
        minimumPartySize: rule.minimum_party_size,
        maximumPartySize: rule.maximum_party_size,
        minimumNoticeMinutes: rule.minimum_notice_minutes,
        maximumAdvanceDays: rule.maximum_advance_days,
        requiresManualApproval: rule.requires_manual_approval,
        requiresDeposit: rule.requires_deposit,
        depositAmount: asNumber(rule.deposit_amount),
      } : undefined,
      locationAvailable: Boolean(locationResult.data?.booking_enabled && locationResult.data.status === "active" && restaurant?.status === "active"),
      timezone: getRestaurantLocationById(this.locationId)?.timezone ?? restaurantConfig.timezone,
      now: new Date(),
    };
  }

  async createHold(input: CreateHoldInput) {
    const availability = checkAvailability({ ...input.availability, requestedTime: formatTimeInZone(input.startAt) }, await this.getAvailabilityContext());
    const option = availability.availableOptions.find((item) => item.startAt === input.startAt);
    if (!option) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
    const { data, error } = await getSupabaseAdmin().rpc("create_reservation_hold", {
      p_location_id: input.availability.locationId,
      p_session_id: input.sessionId,
      p_source: input.availability.source,
      p_party_size: input.availability.partySize,
      p_start_at: option.startAt,
      p_end_at: option.endAt,
      p_table_ids: option.tableIds,
      p_combination_id: option.combinationId ?? null,
      p_dining_area_id: option.diningArea.id,
      p_expires_at: new Date(Date.now() + restaurantConfig.holdMinutes * 60_000).toISOString(),
    });
    if (error) {
      if (error.message.includes("CAPACITY_EXCEEDED") || error.message.includes("ARRIVAL_LIMIT_EXCEEDED")) throw new CapacityExceededError();
      if (["SLOT_UNAVAILABLE", "TABLE_UNAVAILABLE", "TABLE_CAPACITY_MISMATCH", "LOCATION_CLOSED", "BOOKING_WINDOW_VIOLATION", "MANUAL_APPROVAL_REQUIRED"].some((code) => error.message.includes(code))) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
      throw error;
    }
    const row = (Array.isArray(data) ? data[0] : data) as Row | null;
    if (!row) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
    return { id: asString(row.id), locationId: asString(row.location_id), sessionId: asString(row.session_id), partySize: asNumber(row.party_size), startAt: asString(row.start_at), endAt: asString(row.end_at), tableIds: Array.isArray(row.table_ids) ? row.table_ids.map(String) : [], combinationId: asString(row.combination_id) || undefined, diningAreaId: asString(row.dining_area_id), expiresAt: asString(row.expires_at), status: asString(row.status) as ReservationHold["status"], createdAt: asString(row.created_at) };
  }

  async releaseHold(holdId: string, sessionId?: string) {
    let query = getSupabaseAdmin().from("reservation_holds").update({ status: "released" }).eq("id", holdId).eq("location_id", this.locationId).eq("status", "active");
    if (sessionId) query = query.eq("session_id", sessionId);
    const { error } = await query;
    if (error) throw error;
  }

  async confirmHold(input: ConfirmHoldInput): Promise<ConfirmedReservation> {
    const { data: hold, error: holdError } = await getSupabaseAdmin().from("reservation_holds").select("location_id").eq("id", input.holdId).maybeSingle();
    if (holdError) throw holdError;
    if (!hold || asString(hold.location_id) !== this.locationId) throw new HoldExpiredError();
    const token = managementTokenForIdempotency(input.idempotencyKey);
    const { data, error } = await getSupabaseAdmin().rpc("confirm_reservation_from_hold", {
      p_hold_id: input.holdId, p_idempotency_key: input.idempotencyKey, p_management_token_hash: hashManagementToken(token),
      p_customer: input.customer, p_customer_notes: input.customerNotes ?? null, p_special_occasion: input.specialOccasion ?? null,
    });
    if (error) {
      if (error.message.includes("HOLD_EXPIRED")) throw new HoldExpiredError();
      if (error.message.includes("SLOT_UNAVAILABLE")) throw new SlotUnavailableError();
      throw error;
    }
    const reservationId = typeof data === "string" ? data : asString((data as Row | null)?.reservation_id);
    const { data: reservationRow, error: fetchError } = await getSupabaseAdmin().from("reservations").select(reservationSelect).eq("id", reservationId).single();
    if (fetchError || !reservationRow) throw fetchError ?? new ReservationNotFoundError();
    return { reservation: toPublic(mapReservation(reservationRow as Row)), managementToken: token };
  }

  async listReservations() {
    const { data, error } = await getSupabaseAdmin().from("reservations").select(reservationSelect).eq("location_id", this.locationId).order("start_at");
    if (error) throw error;
    return ((data ?? []) as Row[]).map(mapReservation).map(toPublic);
  }

  private async reservationByToken(token: string) {
    const { data, error } = await getSupabaseAdmin().from("reservations").select(reservationSelect).eq("management_token_hash", hashManagementToken(token)).eq("location_id", this.locationId).maybeSingle();
    if (error) throw error;
    return data ? mapReservation(data as Row) : null;
  }
  async findReservationByToken(token: string) { const row = await this.reservationByToken(token); return row ? toPublic(row) : null; }
  async updateReservationByToken(token: string, changes: Partial<Reservation>) {
    const current = await this.reservationByToken(token); if (!current) throw new ReservationNotFoundError();
    assertCustomerCanModifyReservation(current);
    const customerUpdate: Row = {};
    if (changes.customer?.allergies !== undefined) customerUpdate.allergies = changes.customer.allergies;
    if (changes.customer?.accessibilityNeeds !== undefined) customerUpdate.accessibility_needs = changes.customer.accessibilityNeeds;
    const updateCustomer = async () => {
      if (Object.keys(customerUpdate).length === 0) return;
      const customerResult = await getSupabaseAdmin().from("customers").update(customerUpdate).eq("id", current.customerId);
      if (customerResult.error) throw customerResult.error;
    };
    const requiresAvailabilityCheck = changes.partySize !== undefined || changes.startAt !== undefined || changes.durationMinutes !== undefined;
    if (requiresAvailabilityCheck) {
      const targetStart = changes.startAt ?? current.startAt;
      const targetPartySize = changes.partySize ?? current.partySize;
      const availabilityContext = await this.getAvailabilityContext();
      availabilityContext.reservations = availabilityContext.reservations.filter((row) => row.id !== current.id);
      const availability = checkAvailability({
        locationId: current.locationId,
        date: changes.reservationDate ?? current.reservationDate,
        requestedTime: formatTimeInZone(targetStart),
        partySize: targetPartySize,
        preferredAreaId: current.diningAreaId,
        requestedDuration: changes.durationMinutes,
        source: "web",
      }, availabilityContext);
      const option = availability.availableOptions.find((item) => item.startAt === targetStart);
      if (!option) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
      const { data: reservationId, error } = await getSupabaseAdmin().rpc("modify_reservation_from_token", {
        p_management_token_hash: hashManagementToken(token),
        p_party_size: targetPartySize,
        p_start_at: option.startAt,
        p_end_at: option.endAt,
        p_duration_minutes: option.durationMinutes,
        p_table_ids: option.tableIds,
        p_combination_id: option.combinationId ?? null,
        p_dining_area_id: option.diningArea.id,
        p_customer_notes: changes.customerNotes ?? current.customerNotes ?? null,
      });
      if (error) {
        if (error.message.includes("CAPACITY_EXCEEDED") || error.message.includes("ARRIVAL_LIMIT_EXCEEDED")) throw new CapacityExceededError();
        if (["SLOT_UNAVAILABLE", "TABLE_UNAVAILABLE", "TABLE_CAPACITY_MISMATCH", "LOCATION_CLOSED", "BOOKING_WINDOW_VIOLATION", "MANUAL_APPROVAL_REQUIRED"].some((code) => error.message.includes(code))) throw new SlotUnavailableError({ alternatives: availability.alternativeSlots });
        throw error;
      }
      await updateCustomer();
      const { data, error: fetchError } = await getSupabaseAdmin().from("reservations").select(reservationSelect).eq("id", asString(reservationId, current.id)).single();
      if (fetchError) throw fetchError;
      return toPublic(mapReservation(data as Row));
    }
    await updateCustomer();
    if (changes.customerNotes !== undefined) {
      const { data, error } = await getSupabaseAdmin().from("reservations").update({ customer_notes: changes.customerNotes, updated_at: new Date().toISOString() }).eq("id", current.id).select(reservationSelect).single();
      if (error) throw error;
      return toPublic(mapReservation(data as Row));
    }
    const { data, error } = await getSupabaseAdmin().from("reservations").select(reservationSelect).eq("id", current.id).single();
    if (error) throw error;
    return toPublic(mapReservation(data as Row));
  }
  async cancelReservationByToken(token: string, reason?: string) {
    const current = await this.reservationByToken(token); if (!current) throw new ReservationNotFoundError();
    assertCustomerCanCancelReservation(current);
    const { data, error } = await getSupabaseAdmin().from("reservations").update({ status: "cancelled_by_customer", cancellation_reason: reason, cancelled_at: new Date().toISOString() }).eq("id", current.id).select(reservationSelect).single();
    if (error) throw error; return toPublic(mapReservation(data as Row));
  }
  async updateReservationByStaff(id: string, changes: { status?: Reservation["status"]; tableIds?: string[]; customerNotes?: string }) {
    const db = getSupabaseAdmin();
    if (changes.tableIds) {
      const reassigned = await db.rpc("reassign_reservation_tables", { p_reservation_id: id, p_table_ids: changes.tableIds, p_status: changes.status ?? null, p_customer_notes: changes.customerNotes ?? null });
      if (reassigned.error) {
        if (reassigned.error.message.includes("TABLE_CONFLICT")) throw new TableConflictError();
        throw reassigned.error;
      }
      const result = await db.from("reservations").select(reservationSelect).eq("id", id).single();
      if (result.error) throw result.error;
      return toPublic(mapReservation(result.data as Row));
    }
    const mutation = await db.rpc("update_reservation_by_staff", {
      p_reservation_id: id,
      p_status: changes.status ?? null,
      p_customer_notes: changes.customerNotes ?? null,
      p_update_notes: changes.customerNotes !== undefined,
    });
    if (mutation.error) throw mutation.error;
    const { data, error } = await db.from("reservations").select(reservationSelect).eq("id", id).single();
    if (error) throw error; return toPublic(mapReservation(data as Row));
  }
  async addWaitlist(entry: Omit<WaitlistEntry, "id" | "locationId" | "status" | "priority" | "createdAt">) {
    const { data, error } = await getSupabaseAdmin().from("waitlist_entries").insert({ location_id: this.locationId, requested_date: entry.requestedDate, requested_start_at: entry.requestedStartAt, party_size: entry.partySize, flexibility_minutes: entry.flexibilityMinutes, preferred_area_id: entry.preferredAreaId, notes: entry.notes, status: "waiting", customer_snapshot: entry.customer }).select("*").single();
    if (error) throw error; const row = data as Row; return { ...entry, id: asString(row.id), locationId: asString(row.location_id, this.locationId), status: "waiting" as const, priority: asNumber(row.priority), createdAt: asString(row.created_at) };
  }
  async updateWaitlist(id: string, status: WaitlistEntry["status"]) { const db = getSupabaseAdmin(); const { data: current, error: currentError } = await db.from("waitlist_entries").select("status").eq("id", id).eq("location_id", this.locationId).maybeSingle(); if (currentError) throw currentError; if (!current) throw new ReservationNotFoundError(); const currentStatus = asString(current.status) as WaitlistEntry["status"]; if (currentStatus !== status) assertWaitlistTransition(currentStatus, status); const { data, error } = await db.from("waitlist_entries").update({ status, offered_start_at: status === "offered" ? new Date().toISOString() : undefined, offer_expires_at: status === "offered" ? new Date(Date.now() + 10 * 60_000).toISOString() : undefined }).eq("id", id).eq("location_id", this.locationId).select("*").single(); if (error) throw error; const row = data as Row; return { id: asString(row.id), locationId: asString(row.location_id), customer: (row.customer_snapshot ?? {}) as WaitlistEntry["customer"], requestedDate: asString(row.requested_date), requestedStartAt: asString(row.requested_start_at), partySize: asNumber(row.party_size), flexibilityMinutes: asNumber(row.flexibility_minutes), preferredAreaId: asString(row.preferred_area_id) || undefined, status: asString(row.status) as WaitlistEntry["status"], priority: asNumber(row.priority), notes: asString(row.notes) || undefined, createdAt: asString(row.created_at) }; }
  async listWaitlist() { const { data, error } = await getSupabaseAdmin().from("waitlist_entries").select("*").eq("location_id", this.locationId); if (error) throw error; return ((data ?? []) as Row[]).map((row) => ({ id: asString(row.id), locationId: asString(row.location_id), customer: (row.customer_snapshot ?? {}) as WaitlistEntry["customer"], requestedDate: asString(row.requested_date), requestedStartAt: asString(row.requested_start_at), partySize: asNumber(row.party_size), flexibilityMinutes: asNumber(row.flexibility_minutes), preferredAreaId: asString(row.preferred_area_id) || undefined, status: asString(row.status) as WaitlistEntry["status"], priority: asNumber(row.priority), notes: asString(row.notes) || undefined, createdAt: asString(row.created_at) })); }
  async listCustomers() {
    const db = getSupabaseAdmin();
    const reservationResult = await db.from("reservations").select("customer_id").eq("location_id", this.locationId).limit(500);
    if (reservationResult.error) throw reservationResult.error;
    const customerIds = [...new Set(((reservationResult.data ?? []) as Row[]).map((row) => asString(row.customer_id)).filter(Boolean))];
    if (customerIds.length === 0) return [];
    const { data, error } = await db.from("customers").select("*").eq("organization_id", restaurantConfig.organizationId).in("id", customerIds).limit(100);
    if (error) throw error;
    return ((data ?? []) as Row[]).map(mapCustomer);
  }
  async recordVoiceEscalation(input: VoiceEscalationInput) {
    const relatedCallId = input.providerCallId?.trim();
    const providerCallId = relatedCallId ? `escalation:${relatedCallId}` : `escalation:${randomUUID()}`;
    const { data, error } = await getSupabaseAdmin().from("voice_calls").upsert({
      location_id: this.locationId,
      provider: "retell",
      provider_call_id: providerCallId,
      caller_phone: input.callerPhone ?? null,
      direction: "inbound",
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      status: "callback_requested",
      intent: "Escalation al personale",
      outcome: "Richiamata richiesta",
      reservation_id: input.reservationId ?? null,
      summary: { text: input.summary },
      sentiment: "neutral",
      human_escalation_required: true,
      metadata: { escalation_reason: input.reason, related_call_id: relatedCallId ?? null },
    }, { onConflict: "provider,provider_call_id" }).select("*").single();
    if (error) throw error;
    return mapVoiceCall(data as Row);
  }
  async listCalls() { const { data, error } = await getSupabaseAdmin().from("voice_calls").select("*").eq("location_id", this.locationId).order("started_at", { ascending: false }).limit(100); if (error) throw error; return ((data ?? []) as Row[]).map(mapVoiceCall); }
  async listEvents() {
    const db = getSupabaseAdmin();
    const reservationResult = await db.from("reservations").select("id").eq("location_id", this.locationId).limit(500);
    if (reservationResult.error) throw reservationResult.error;
    const reservationIds = ((reservationResult.data ?? []) as Row[]).map((row) => asString(row.id)).filter(Boolean);
    if (reservationIds.length === 0) return [];
    const { data, error } = await db.from("reservation_events").select("*").in("reservation_id", reservationIds).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((row) => ({ id: asString(row.id), reservationId: asString(row.reservation_id), eventType: asString(row.event_type), previousData: row.previous_data as Partial<Reservation>, newData: row.new_data as Partial<Reservation>, source: asString(row.source), actorType: asString(row.actor_type) as ReservationEvent["actorType"], createdAt: asString(row.created_at) }));
  }
}
