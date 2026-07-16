import { restaurantConfig, restaurantLocations } from "@/config/brand";
import { localDateTimeToUtc } from "@/lib/datetime";
import type { Customer, Reservation, ServicePeriod, TableCombination, TableResource, VoiceCall, WaitlistEntry } from "@/types/domain";

const internalArea = "10000000-0000-0000-0000-000000000001";
const terraceArea = "10000000-0000-0000-0000-000000000002";
const organizationId = "00000000-0000-0000-0000-000000000001";

function table(index: number, capacity: number, areaId: string, x: number, y: number, shape: TableResource["shape"] = "round"): TableResource {
  return {
    id: `20000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    code: `T${index}`,
    displayName: `Tavolo ${index}`,
    diningAreaId: areaId,
    diningAreaName: areaId === internalArea ? "Sala interna" : "Terrazza",
    minimumCapacity: capacity > 2 ? Math.max(2, capacity - 2) : 1,
    maximumCapacity: capacity,
    shape,
    positionX: x,
    positionY: y,
    width: shape === "rectangle" ? 120 : 86,
    height: shape === "rectangle" ? 70 : 86,
    isAccessible: index === 1 || index === 9,
    isOutdoor: areaId === terraceArea,
    isStrategic: capacity >= 6,
    status: index === 15 ? "blocked" : "available",
  };
}

export const demoTables: TableResource[] = [
  table(1, 2, internalArea, 8, 10), table(2, 2, internalArea, 30, 10), table(3, 4, internalArea, 52, 10),
  table(4, 4, internalArea, 75, 10, "square"), table(5, 4, internalArea, 12, 42, "square"), table(6, 4, internalArea, 38, 42, "square"),
  table(7, 6, internalArea, 66, 42, "rectangle"), table(8, 8, internalArea, 16, 72, "rectangle"),
  table(9, 2, terraceArea, 8, 12), table(10, 2, terraceArea, 30, 12), table(11, 4, terraceArea, 52, 12),
  table(12, 4, terraceArea, 74, 12), table(13, 6, terraceArea, 18, 52, "rectangle"), table(14, 6, terraceArea, 54, 52, "rectangle"),
  table(15, 4, terraceArea, 80, 52, "square"),
];

export const demoCombinations: TableCombination[] = [
  { id: "30000000-0000-0000-0000-000000000001", name: "T5 + T6", tableIds: [demoTables[4].id, demoTables[5].id], minimumCapacity: 5, maximumCapacity: 8, isActive: true },
  { id: "30000000-0000-0000-0000-000000000002", name: "T11 + T12", tableIds: [demoTables[10].id, demoTables[11].id], minimumCapacity: 5, maximumCapacity: 8, isActive: true },
];

export const demoServices: ServicePeriod[] = Array.from({ length: 7 }, (_, dayOfWeek) => [
  ...(dayOfWeek === 0 || dayOfWeek === 6 ? [{ id: `40000000-0000-0000-0001-${String(dayOfWeek).padStart(12, "0")}`, name: "Pranzo", dayOfWeek, startTime: "12:00", endTime: "15:00", slotIntervalMinutes: 30, defaultDurationMinutes: 120, turnaroundMinutes: 15, maximumCovers: 54, maximumArrivalsPerSlot: 7, onlineBookingEnabled: true, phoneBookingEnabled: true, isActive: true }] : []),
  { id: `40000000-0000-0000-0002-${String(dayOfWeek).padStart(12, "0")}`, name: "Cena", dayOfWeek, startTime: "19:00", endTime: "23:30", slotIntervalMinutes: 30, defaultDurationMinutes: 120, turnaroundMinutes: 15, maximumCovers: 62, maximumArrivalsPerSlot: 8, onlineBookingEnabled: true, phoneBookingEnabled: true, isActive: true },
]).flat();

const demoCustomers: Customer[] = [
  { id: "50000000-0000-0000-0000-000000000001", firstName: "Giulia", lastName: "Bianchi (Demo)", phone: "+390000000001", email: "giulia.demo@example.test", preferredLanguage: "it", marketingConsent: true, privacyConsent: true, customerType: "vip", allergies: "Frutta a guscio", totalBookings: 14, noShowCount: 0 },
  { id: "50000000-0000-0000-0000-000000000002", firstName: "Marco", lastName: "Rossi (Demo)", phone: "+390000000002", email: "marco.demo@example.test", preferredLanguage: "it", marketingConsent: false, privacyConsent: true, customerType: "regular", totalBookings: 6, noShowCount: 1 },
  { id: "50000000-0000-0000-0000-000000000003", firstName: "Elena", lastName: "Verdi (Demo)", phone: "+390000000003", preferredLanguage: "en", marketingConsent: false, privacyConsent: true, customerType: "new", accessibilityNeeds: "Accesso senza gradini", totalBookings: 1, noShowCount: 0 },
];

function isoToday(hour: number, minute: number) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: restaurantConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return localDateTimeToUtc(date, `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`).toISOString();
}

function dateOnly(value: string) { return value.slice(0, 10); }

export function createDemoReservations(): Reservation[] {
  const now = new Date().toISOString();
  const rows: Array<[string, string, Customer, number, number, number, string, Reservation["status"], Reservation["source"], string[]]> = [
    [restaurantLocations[0].id, "YK-2401", demoCustomers[0], 19, 30, 4, "Sala interna", "confirmed", "web", [demoTables[2].id]],
    [restaurantLocations[0].id, "YK-2402", demoCustomers[1], 20, 0, 2, "Sala interna", "arriving", "phone_ai", [demoTables[0].id]],
    [restaurantLocations[0].id, "YK-2403", demoCustomers[2], 20, 30, 6, "Terrazza", "confirmed", "admin", [demoTables[12].id]],
    [restaurantLocations[0].id, "YK-2404", demoCustomers[1], 21, 0, 4, "Sala interna", "confirmed", "web", [demoTables[3].id]],
    [restaurantLocations[0].id, "YK-2405", demoCustomers[0], 21, 30, 8, "Sala interna", "confirmed", "phone_staff", [demoTables[4].id, demoTables[5].id]],
    [restaurantLocations[1].id, "KS-3101", demoCustomers[2], 19, 0, 2, "Terrazza", "confirmed", "web", [demoTables[8].id]],
    [restaurantLocations[1].id, "KS-3102", demoCustomers[0], 19, 45, 4, "Sala interna", "arriving", "phone_staff", [demoTables[3].id]],
    [restaurantLocations[1].id, "KS-3103", demoCustomers[1], 20, 30, 6, "Terrazza", "confirmed", "phone_ai", [demoTables[13].id]],
    [restaurantLocations[1].id, "KS-3104", demoCustomers[2], 21, 15, 4, "Sala interna", "confirmed", "admin", [demoTables[5].id]],
  ];
  return rows.map(([locationId, code, customer, hour, minute, partySize, area, status, source, tableIds], index) => {
    const startAt = isoToday(hour, minute);
    const durationMinutes = partySize <= 2 ? 90 : partySize <= 4 ? 120 : partySize <= 6 ? 150 : 180;
    const endAt = new Date(new Date(startAt).getTime() + (durationMinutes + 15) * 60_000).toISOString();
    return {
      id: `60000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
      organizationId,
      restaurantId: restaurantLocations.find((restaurant) => restaurant.id === locationId)?.restaurantId ?? restaurantConfig.id,
      locationId,
      customerId: customer.id,
      servicePeriodId: demoServices.find((service) => service.name === "Cena")?.id ?? demoServices[0].id,
      reservationCode: code,
      managementTokenHash: `demo-hash-${index}`,
      source,
      status,
      partySize,
      reservationDate: dateOnly(startAt),
      startAt,
      endAt,
      durationMinutes,
      diningAreaId: area === "Terrazza" ? terraceArea : internalArea,
      tableIds,
      customer,
      customerNotes: index === 0 ? "Anniversario" : undefined,
      specialOccasion: index === 0 ? "Anniversario" : undefined,
      language: customer.preferredLanguage,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function createDemoWaitlist(): WaitlistEntry[] {
  const date = new Date().toISOString().slice(0, 10);
  return [
    { id: "70000000-0000-0000-0000-000000000001", locationId: restaurantLocations[0].id, customer: { firstName: "Paolo", lastName: "Demo", phone: "+390000000010" }, requestedDate: date, requestedStartAt: localDateTimeToUtc(date, "20:30").toISOString(), partySize: 4, flexibilityMinutes: 60, status: "waiting", priority: 2, createdAt: new Date().toISOString() },
    { id: "70000000-0000-0000-0000-000000000002", locationId: restaurantLocations[0].id, customer: { firstName: "Sara", lastName: "Demo", phone: "+390000000011" }, requestedDate: date, requestedStartAt: localDateTimeToUtc(date, "21:00").toISOString(), partySize: 2, flexibilityMinutes: 30, status: "offered", priority: 1, createdAt: new Date().toISOString() },
    { id: "70000000-0000-0000-0000-000000000003", locationId: restaurantLocations[1].id, customer: { firstName: "Marta", lastName: "Demo", phone: "+390000000012" }, requestedDate: date, requestedStartAt: localDateTimeToUtc(date, "20:00").toISOString(), partySize: 3, flexibilityMinutes: 45, status: "waiting", priority: 1, createdAt: new Date().toISOString() },
  ];
}

export const demoCalls: VoiceCall[] = [
  { id: "80000000-0000-0000-0000-000000000001", locationId: restaurantLocations[0].id, provider: "retell", providerCallId: "call_demo_01", callerPhone: "+390000000020", startedAt: isoToday(17, 44), durationSeconds: 132, status: "completed", intent: "Nuova prenotazione", outcome: "Prenotazione creata", summary: "Cena per due persone alle 20:00.", sentiment: "positive", reservationId: "60000000-0000-0000-0000-000000000002", humanEscalationRequired: false },
  { id: "80000000-0000-0000-0000-000000000002", locationId: restaurantLocations[0].id, provider: "retell", providerCallId: "call_demo_02", callerPhone: "+390000000021", startedAt: isoToday(18, 12), durationSeconds: 81, status: "callback_requested", intent: "Evento privato", outcome: "Richiamata richiesta", summary: "Richiesta per gruppo numeroso; escalation al manager.", sentiment: "neutral", humanEscalationRequired: true },
  { id: "80000000-0000-0000-0000-000000000003", locationId: restaurantLocations[1].id, provider: "retell", providerCallId: "call_demo_03", callerPhone: "+390000000022", startedAt: isoToday(18, 28), durationSeconds: 104, status: "completed", intent: "Nuova prenotazione", outcome: "Prenotazione creata", summary: "Tavolo vista porto per sei persone.", sentiment: "positive", reservationId: "60000000-0000-0000-0000-000000000008", humanEscalationRequired: false },
];

export const demoAreas = { internalArea, terraceArea, organizationId };
export { demoCustomers };
