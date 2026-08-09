import type { AvailabilityInput, AvailabilityOption, AvailabilityResult } from "@/types/api";
import { dateKeyInZone, formatTimeInZone, localDateTimeToUtc } from "@/lib/datetime";
import type { RestaurantSettings } from "@/types/settings";
import type {
  Reservation,
  ReservationHold,
  ServicePeriod,
  SpecialClosure,
  TableCombination,
  TableResource,
} from "@/types/domain";

export interface AvailabilityContext {
  tables: TableResource[];
  combinations: TableCombination[];
  servicePeriods: ServicePeriod[];
  reservations: Reservation[];
  holds: ReservationHold[];
  closures: SpecialClosure[];
  durationRules?: RestaurantSettings["durations"];
  bookingConstraints?: {
    minimumPartySize: number;
    maximumPartySize: number;
    minimumNoticeMinutes: number;
    maximumAdvanceDays: number;
    requiresManualApproval: boolean;
    requiresDeposit?: boolean;
    depositAmount?: number;
  };
  locationAvailable?: boolean;
  timezone?: string;
  now?: Date;
}

export interface TableAssignment {
  tableIds: string[];
  combinationId?: string;
  diningAreaId: string;
  diningAreaName: string;
  score: number;
  reason: string;
}

const blockingStatuses = new Set([
  "confirmed",
  "modified",
  "arriving",
  "late",
  "arrived",
  "seated",
]);

export function calculateDuration(partySize: number, requestedDuration?: number, rules?: RestaurantSettings["durations"]) {
  if (requestedDuration) return requestedDuration;
  if (partySize <= 2) return rules?.party1To2 ?? 90;
  if (partySize <= 4) return rules?.party3To4 ?? 120;
  if (partySize <= 6) return rules?.party5To6 ?? 150;
  return rules?.party7To10 ?? 180;
}

export function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}

function atDateTime(date: string, time: string, timeZone?: string) {
  return localDateTimeToUtc(date, time, timeZone);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function timeFromDate(date: Date, timeZone?: string) {
  return formatTimeInZone(date, timeZone);
}

function occupiedTableIds(context: AvailabilityContext, startAt: string, endAt: string, ignoredHoldId?: string) {
  const occupied = new Set<string>();
  for (const reservation of context.reservations) {
    if (blockingStatuses.has(reservation.status) && rangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt)) {
      reservation.tableIds.forEach((id) => occupied.add(id));
    }
  }
  const now = (context.now ?? new Date()).getTime();
  for (const hold of context.holds) {
    if (hold.id !== ignoredHoldId && hold.status === "active" && new Date(hold.expiresAt).getTime() > now && rangesOverlap(startAt, endAt, hold.startAt, hold.endAt)) {
      hold.tableIds.forEach((id) => occupied.add(id));
    }
  }
  return occupied;
}

function closureApplies(closure: SpecialClosure, startAt: string, context: AvailabilityContext) {
  if (closure.type === "opening" || closure.date !== dateKeyInZone(startAt, context.timezone)) return false;
  const time = formatTimeInZone(startAt, context.timezone);
  return !closure.startTime || !closure.endTime || (time >= closure.startTime && time < closure.endTime);
}

function activeTables(context: AvailabilityContext, startAt: string) {
  const closures = context.closures.filter((closure) => closureApplies(closure, startAt, context));
  return context.tables.filter((table) => table.status !== "blocked" && table.status !== "out_of_service"
    && !closures.some((closure) => closure.affectedTableId === table.id || closure.affectedAreaId === table.diningAreaId));
}

/**
 * Tutte le sistemazioni possibili per uno slot, dalla più adatta alla meno.
 *
 * Esiste separata da `findBestTableAssignment` perché il cliente sceglie il
 * tavolo: mostrargli solo il migliore non è una scelta, e mostrargli tavoli che
 * non stanno nel suo gruppo o già occupati è una scelta che poi fallisce alla
 * conferma. Il punteggio serve ancora, ma qui ordina invece di eliminare.
 */
export function listTableAssignments(
  input: Pick<AvailabilityInput, "partySize" | "preferredAreaId" | "accessibilityRequirements" | "tablePreferenceId">,
  context: AvailabilityContext,
  startAt: string,
  endAt: string,
  ignoredHoldId?: string,
): TableAssignment[] {
  const occupied = occupiedTableIds(context, startAt, endAt, ignoredHoldId);
  const tables = activeTables(context, startAt).filter((table) => !occupied.has(table.id));
  const candidates: TableAssignment[] = [];

  for (const table of tables) {
    if (table.minimumCapacity > input.partySize || table.maximumCapacity < input.partySize) continue;
    if (input.accessibilityRequirements && !table.isAccessible) continue;
    let score = table.maximumCapacity - input.partySize;
    if (input.preferredAreaId && table.diningAreaId !== input.preferredAreaId) score += 18;
    if (table.isStrategic && input.partySize <= table.maximumCapacity / 2) score += 8;
    if (table.isAccessible && !input.accessibilityRequirements) score += 1;
    if (input.tablePreferenceId && table.id !== input.tablePreferenceId) score += 4;
    candidates.push({
      tableIds: [table.id],
      diningAreaId: table.diningAreaId,
      diningAreaName: table.diningAreaName,
      score,
      reason: score === 0 ? "Capienza perfetta" : "Tavolo singolo più efficiente",
    });
  }

  for (const combination of context.combinations.filter((item) => item.isActive)) {
    if (combination.minimumCapacity > input.partySize || combination.maximumCapacity < input.partySize) continue;
    const combinedTables = combination.tableIds.map((id) => tables.find((table) => table.id === id));
    if (combinedTables.some((table) => !table)) continue;
    const presentTables = combinedTables.filter((table): table is TableResource => Boolean(table));
    if (input.accessibilityRequirements && !presentTables.some((table) => table.isAccessible)) continue;
    const primaryArea = presentTables[0]?.diningAreaId;
    let score = combination.maximumCapacity - input.partySize + 14;
    if (input.preferredAreaId && primaryArea !== input.preferredAreaId) score += 18;
    candidates.push({
      tableIds: combination.tableIds,
      combinationId: combination.id,
      diningAreaId: primaryArea,
      diningAreaName: presentTables[0]?.diningAreaName ?? "Sala",
      score,
      reason: "Combinazione disponibile",
    });
  }

  return candidates.sort((a, b) => a.score - b.score || a.tableIds.length - b.tableIds.length);
}

export function findBestTableAssignment(
  input: Pick<AvailabilityInput, "partySize" | "preferredAreaId" | "accessibilityRequirements" | "tablePreferenceId">,
  context: AvailabilityContext,
  startAt: string,
  endAt: string,
  ignoredHoldId?: string,
): TableAssignment | null {
  return listTableAssignments(input, context, startAt, endAt, ignoredHoldId)[0] ?? null;
}

/**
 * L'identificativo con cui il cliente sceglie una sistemazione.
 *
 * Una combinazione di tavoli è una scelta sola pur essendo più tavoli, quindi
 * ha un identificativo suo: usare il primo tavolo la renderebbe indistinguibile
 * dal tavolo singolo con lo stesso id, e alla conferma prenoteremmo la cosa
 * sbagliata.
 */
export function tableAssignmentId(assignment: TableAssignment) {
  return assignment.combinationId ?? assignment.tableIds[0];
}

/** Una sistemazione come la vede il cliente: nessun identificativo interno oltre a quello che gli serve per scegliere. */
export interface BookableTableOption {
  id: string;
  kind: "table" | "combination";
  label: string;
  areaName: string;
  seats: number;
  isAccessible: boolean;
  /** La prima della lista: quella che il sistema avrebbe scelto da sé. */
  recommended: boolean;
}

export function listBookableTableOptions(
  input: Pick<AvailabilityInput, "partySize" | "preferredAreaId" | "accessibilityRequirements" | "tablePreferenceId">,
  context: AvailabilityContext,
  startAt: string,
  endAt: string,
  ignoredHoldId?: string,
): BookableTableOption[] {
  const byId = new Map(context.tables.map((table) => [table.id, table]));
  const nameFor = (id: string) => byId.get(id)?.displayName?.trim() || byId.get(id)?.code?.trim() || "Tavolo";
  return listTableAssignments(input, context, startAt, endAt, ignoredHoldId).map((assignment, index) => {
    const tables = assignment.tableIds.map((id) => byId.get(id)).filter((table): table is TableResource => Boolean(table));
    return {
      id: tableAssignmentId(assignment),
      kind: assignment.combinationId ? "combination" as const : "table" as const,
      label: assignment.combinationId ? `Tavoli ${assignment.tableIds.map(nameFor).join(" + ")}` : nameFor(assignment.tableIds[0]),
      areaName: assignment.diningAreaName,
      // La capienza dichiarata è quella che il cliente valuta: la somma per una
      // combinazione, il massimo per un tavolo singolo.
      seats: tables.reduce((total, table) => total + table.maximumCapacity, 0) || input.partySize,
      isAccessible: tables.some((table) => table.isAccessible),
      recommended: index === 0,
    };
  });
}

/**
 * La sistemazione che il cliente ha scelto, se è ancora libera.
 *
 * `null` non significa "non esiste": significa "non è più prenotabile", ed è il
 * caso da mostrare con un messaggio che invita a sceglierne un'altra.
 */
export function findChosenTableAssignment(
  selectionId: string,
  input: Pick<AvailabilityInput, "partySize" | "preferredAreaId" | "accessibilityRequirements" | "tablePreferenceId">,
  context: AvailabilityContext,
  startAt: string,
  endAt: string,
  ignoredHoldId?: string,
): TableAssignment | null {
  const assignments = listTableAssignments(input, context, startAt, endAt, ignoredHoldId);
  return assignments.find((assignment) => tableAssignmentId(assignment) === selectionId) ?? null;
}

function serviceFor(date: string, time: string, input: AvailabilityInput, context: AvailabilityContext) {
  const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return context.servicePeriods.find((service) => {
    const channelEnabled = input.source === "phone_ai" ? service.phoneBookingEnabled : service.onlineBookingEnabled;
    return service.dayOfWeek === day && service.isActive && channelEnabled && time >= service.startTime && time < service.endTime;
  });
}

function isClosed(input: AvailabilityInput, startTime: string, context: AvailabilityContext) {
  return context.closures.some((closure) => {
    if (closure.date !== input.date || closure.type === "opening") return false;
    const isWholeVenue = closure.type === "full_closure" || (!closure.affectedAreaId && !closure.affectedTableId);
    if (!isWholeVenue) return false;
    return !closure.startTime || !closure.endTime || (startTime >= closure.startTime && startTime < closure.endTime);
  });
}

function daysFromToday(inputDate: string, context: AvailabilityContext) {
  const today = dateKeyInZone(context.now ?? new Date(), context.timezone);
  return Math.round((Date.parse(`${inputDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000);
}

function violatesGlobalConstraints(input: AvailabilityInput, context: AvailabilityContext) {
  if (context.locationAvailable === false) return true;
  const rules = context.bookingConstraints;
  if (rules && (input.partySize < rules.minimumPartySize || input.partySize > rules.maximumPartySize || rules.requiresManualApproval)) return true;
  const advance = daysFromToday(input.date, context);
  return advance < 0 || Boolean(rules && advance > rules.maximumAdvanceDays);
}

function coversAt(context: AvailabilityContext, startAt: string, endAt: string) {
  const reservedCovers = context.reservations
    .filter((reservation) => blockingStatuses.has(reservation.status) && rangesOverlap(startAt, endAt, reservation.startAt, reservation.endAt))
    .reduce((sum, reservation) => sum + reservation.partySize, 0);
  const now = (context.now ?? new Date()).getTime();
  const heldCovers = context.holds
    .filter((hold) => hold.status === "active" && new Date(hold.expiresAt).getTime() > now && rangesOverlap(startAt, endAt, hold.startAt, hold.endAt))
    .reduce((sum, hold) => sum + hold.partySize, 0);
  return reservedCovers + heldCovers;
}

function optionFor(input: AvailabilityInput, context: AvailabilityContext, start: Date): AvailabilityOption | null {
  if (violatesGlobalConstraints(input, context)) return null;
  const minimumNotice = context.bookingConstraints?.minimumNoticeMinutes ?? 0;
  if (start.getTime() < (context.now ?? new Date()).getTime() + minimumNotice * 60_000) return null;
  const startTime = timeFromDate(start, context.timezone);
  const service = serviceFor(input.date, startTime, input, context);
  if (!service || isClosed(input, startTime, context)) return null;
  const durationMinutes = calculateDuration(input.partySize, input.requestedDuration, context.durationRules);
  const end = addMinutes(start, durationMinutes + service.turnaroundMinutes);
  const serviceEnd = atDateTime(input.date, service.endTime, context.timezone);
  if (end.getTime() > serviceEnd.getTime() + service.turnaroundMinutes * 60_000) return null;
  const startAt = start.toISOString();
  const endAt = end.toISOString();
  if (coversAt(context, startAt, endAt) + input.partySize > service.maximumCovers) return null;
  const now = (context.now ?? new Date()).getTime();
  const arrivals = context.reservations.filter((reservation) => blockingStatuses.has(reservation.status) && reservation.startAt === startAt).length
    + context.holds.filter((hold) => hold.status === "active" && new Date(hold.expiresAt).getTime() > now && hold.startAt === startAt).length;
  if (arrivals >= service.maximumArrivalsPerSlot) return null;
  const assignment = findBestTableAssignment(input, context, startAt, endAt);
  if (!assignment) return null;
  return {
    startAt,
    endAt,
    durationMinutes,
    diningArea: { id: assignment.diningAreaId, name: assignment.diningAreaName },
    tableIds: assignment.tableIds,
    combinationId: assignment.combinationId,
    score: assignment.score,
    availabilityReason: assignment.reason,
  };
}

export function getAvailableSlots(input: AvailabilityInput, context: AvailabilityContext): AvailabilityOption[] {
  if (violatesGlobalConstraints(input, context)) return [];
  const day = new Date(`${input.date}T12:00:00.000Z`).getUTCDay();
  const services = context.servicePeriods.filter((service) => service.dayOfWeek === day && service.isActive);
  const options: AvailabilityOption[] = [];
  for (const service of services) {
    let cursor = atDateTime(input.date, service.startTime, context.timezone);
    const end = atDateTime(input.date, service.endTime, context.timezone);
    while (cursor < end) {
      const option = optionFor(input, context, cursor);
      if (option) options.push(option);
      cursor = addMinutes(cursor, service.slotIntervalMinutes);
    }
  }
  return options.sort((a, b) => a.startAt.localeCompare(b.startAt));
}

export function checkAvailability(input: AvailabilityInput, context: AvailabilityContext): AvailabilityResult {
  const restrictions: string[] = [];
  const rules = context.bookingConstraints;
  const requiresManualApproval = input.partySize > (rules?.maximumPartySize ?? 10) || Boolean(rules?.requiresManualApproval) || Boolean(rules?.requiresDeposit);
  if (context.locationAvailable === false) restrictions.push("La sede non accetta prenotazioni in questo momento.");
  if (rules && input.partySize < rules.minimumPartySize) restrictions.push(`Il numero minimo di ospiti è ${rules.minimumPartySize}.`);
  if (input.partySize > (rules?.maximumPartySize ?? 10)) restrictions.push(`I gruppi oltre ${rules?.maximumPartySize ?? 10} persone richiedono approvazione manuale.`);
  if (rules?.requiresManualApproval) restrictions.push("Le nuove richieste richiedono conferma manuale del personale.");
  if (rules?.requiresDeposit) restrictions.push(`È richiesto un deposito di € ${(rules.depositAmount ?? 0).toFixed(2)} e la conferma del personale.`);
  const advance = daysFromToday(input.date, context);
  if (advance < 0) restrictions.push("La data selezionata è già trascorsa.");
  if (rules && advance > rules.maximumAdvanceDays) restrictions.push(`Le prenotazioni aprono ${rules.maximumAdvanceDays} giorni prima.`);
  const wholeDayClosure = context.closures.find((closure) => closure.date === input.date && closure.type !== "opening" && !closure.affectedAreaId && !closure.affectedTableId && !closure.startTime && !closure.endTime);
  if (wholeDayClosure) {
    restrictions.push(`Il ristorante è chiuso nella data selezionata${wholeDayClosure.reason ? `: ${wholeDayClosure.reason}` : ""}.`);
  }

  const options = requiresManualApproval ? [] : getAvailableSlots(input, context);
  const requested = input.requestedTime
    ? options.find((option) => formatTimeInZone(option.startAt, context.timezone) === input.requestedTime)
    : undefined;
  const requestedMinutes = input.requestedTime
    ? Number(input.requestedTime.slice(0, 2)) * 60 + Number(input.requestedTime.slice(3, 5))
    : undefined;
  const byDistance = [...options].sort((a, b) => {
    if (requestedMinutes === undefined) return a.startAt.localeCompare(b.startAt);
    const minutes = (value: string) => {
      const localTime = formatTimeInZone(value, context.timezone);
      return Number(localTime.slice(0, 2)) * 60 + Number(localTime.slice(3, 5));
    };
    return Math.abs(minutes(a.startAt) - requestedMinutes) - Math.abs(minutes(b.startAt) - requestedMinutes);
  });

  return {
    requestedSlotAvailable: Boolean(requested) || (!input.requestedTime && options.length > 0),
    availableOptions: input.requestedTime ? (requested ? [requested] : []) : options,
    alternativeSlots: byDistance.filter((option) => option !== requested).slice(0, 6),
    restrictions,
    requiresManualApproval,
  };
}

export function validateReservationChange(input: AvailabilityInput, context: AvailabilityContext) {
  return checkAvailability(input, context);
}

export function recalculateAvailability(input: AvailabilityInput, context: AvailabilityContext) {
  return getAvailableSlots(input, context);
}
