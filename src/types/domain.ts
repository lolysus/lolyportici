import type { Permission, Role } from "@/config/permissions";

export const reservationStatuses = [
  "draft",
  "held",
  "pending_confirmation",
  "pending_approval",
  "confirmed",
  "modified",
  "arriving",
  "late",
  "arrived",
  "seated",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_restaurant",
  "no_show",
  "waitlisted",
  "offered",
  "expired",
] as const;

export type ReservationStatus = (typeof reservationStatuses)[number];

/**
 * Un tetto agli arrivi in una fascia oraria, indipendente dai tavoli fisici.
 *
 * `ServicePeriod.maximumArrivalsPerSlot` vale per l'intero servizio: non
 * distingue le 19:00 dalle 22:00. Una fascia qui si sovrappone al servizio e,
 * dove esiste, restringe ulteriormente quel limite — non lo sostituisce. Vale
 * ogni giorno della settimana.
 */
export interface CapacityBand {
  id: string;
  locationId: string;
  startTime: string;
  endTime: string;
  maxArrivals: number;
  isActive: boolean;
}
export type ReservationSource = "web" | "phone_ai" | "phone_staff" | "walk_in" | "admin" | "waitlist" | "integration";
export type TableStatus = "available" | "reserved" | "arriving" | "occupied" | "late" | "cleaning" | "blocked" | "out_of_service";

export interface TableResource {
  id: string;
  code: string;
  displayName: string;
  diningAreaId: string;
  diningAreaName: string;
  minimumCapacity: number;
  maximumCapacity: number;
  shape: "square" | "rectangle" | "round" | "oval" | "counter";
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  isAccessible: boolean;
  isOutdoor: boolean;
  isStrategic: boolean;
  status: TableStatus;
}

export interface TableCombination {
  id: string;
  name: string;
  tableIds: string[];
  minimumCapacity: number;
  maximumCapacity: number;
  isActive: boolean;
}

export interface ServicePeriod {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotIntervalMinutes: number;
  defaultDurationMinutes: number;
  turnaroundMinutes: number;
  maximumCovers: number;
  maximumArrivalsPerSlot: number;
  onlineBookingEnabled: boolean;
  phoneBookingEnabled: boolean;
  isActive: boolean;
}

export interface SpecialClosure {
  id: string;
  date: string;
  startTime?: string;
  endTime?: string;
  type: "opening" | "full_closure" | "partial_closure" | "private_event" | "maintenance";
  reason: string;
  affectedAreaId?: string;
  affectedTableId?: string;
}

export interface Reservation {
  id: string;
  organizationId: string;
  restaurantId: string;
  locationId: string;
  customerId: string;
  servicePeriodId: string;
  reservationCode: string;
  managementTokenHash: string;
  source: ReservationSource;
  status: ReservationStatus;
  partySize: number;
  reservationDate: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  diningAreaId?: string;
  tableIds: string[];
  combinationId?: string;
  customer: Customer;
  customerNotes?: string;
  internalNotes?: string;
  specialOccasion?: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationHold {
  id: string;
  locationId: string;
  sessionId: string;
  partySize: number;
  startAt: string;
  endAt: string;
  tableIds: string[];
  combinationId?: string;
  diningAreaId: string;
  expiresAt: string;
  status: "active" | "converted" | "released" | "expired";
  createdAt: string;
  /**
   * Il canale con cui è nato l'hold — assente nelle letture che non ne hanno
   * bisogno. `confirmHold` lo riporta sulla prenotazione: senza, una
   * prenotazione presa al telefono risulterebbe "web" come una online, e i
   * filtri per canale in agenda mentirebbero.
   */
  source?: ReservationSource;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  preferredLanguage: string;
  marketingConsent: boolean;
  privacyConsent: boolean;
  customerType: "new" | "regular" | "loyal" | "vip" | "corporate" | "inactive" | "no_show_risk";
  allergies?: string;
  accessibilityNeeds?: string;
  totalBookings: number;
  noShowCount: number;
  lastVisitAt?: string;
}

export interface WaitlistEntry {
  id: string;
  locationId: string;
  customer: Pick<Customer, "firstName" | "lastName" | "phone">;
  requestedDate: string;
  requestedStartAt: string;
  partySize: number;
  flexibilityMinutes: number;
  preferredAreaId?: string;
  status: "waiting" | "offered" | "converted" | "expired" | "cancelled";
  priority: number;
  notes?: string;
  createdAt: string;
}

export interface VoiceCall {
  id: string;
  locationId: string;
  provider: "retell" | "telnyx";
  providerCallId: string;
  callerPhone: string;
  startedAt: string;
  durationSeconds: number;
  status: "completed" | "transferred" | "failed" | "callback_requested";
  intent: string;
  outcome: string;
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  reservationId?: string;
  humanEscalationRequired: boolean;
}

export interface KnowledgeBaseItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  language: "it" | "en" | "es";
  isPublic: boolean;
  isActive: boolean;
  priority: number;
}

export interface StaffSession {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  organizationId: string;
  /** L'unico ristorante a cui questo account appartiene. */
  locationId: string;
  /**
   * Le sedi che l'account può aprire. Normalmente è una sola: non esiste più
   * un profilo che sta sopra i due ristoranti e li guarda insieme.
   */
  accessibleLocationIds: string[];
  demo: boolean;
}

export interface ReservationEvent {
  id: string;
  reservationId: string;
  eventType: string;
  previousData?: Partial<Reservation>;
  newData?: Partial<Reservation>;
  source: string;
  actorType: "customer" | "staff" | "voice" | "system";
  createdAt: string;
}
