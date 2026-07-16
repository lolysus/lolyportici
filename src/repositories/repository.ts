import type { AvailabilityContext } from "@/domains/availability/availability-service";
import type { AvailabilityInput } from "@/types/api";
import type { Customer, Reservation, ReservationEvent, ReservationHold, ReservationStatus, VoiceCall, WaitlistEntry } from "@/types/domain";

export type PublicReservation = Omit<Reservation, "managementTokenHash" | "internalNotes">;

export interface CreateHoldInput {
  availability: AvailabilityInput;
  startAt: string;
  sessionId: string;
}

export interface ConfirmHoldInput {
  holdId: string;
  idempotencyKey: string;
  customer: Omit<Customer, "id" | "customerType" | "totalBookings" | "noShowCount">;
  customerNotes?: string;
  specialOccasion?: string;
}

export interface ConfirmedReservation {
  reservation: PublicReservation;
  managementToken: string;
}

export interface VoiceEscalationInput {
  callerPhone?: string;
  providerCallId?: string;
  reason: string;
  summary: string;
  reservationId?: string;
}

export interface ReservationRepository {
  getAvailabilityContext(): Promise<AvailabilityContext>;
  createHold(input: CreateHoldInput): Promise<ReservationHold>;
  releaseHold(holdId: string): Promise<void>;
  confirmHold(input: ConfirmHoldInput): Promise<ConfirmedReservation>;
  listReservations(): Promise<PublicReservation[]>;
  findReservationByToken(token: string): Promise<PublicReservation | null>;
  updateReservationByToken(token: string, changes: Partial<Reservation>): Promise<PublicReservation>;
  cancelReservationByToken(token: string, reason?: string): Promise<PublicReservation>;
  updateReservationByStaff(id: string, changes: { status?: ReservationStatus; tableIds?: string[]; customerNotes?: string }): Promise<PublicReservation>;
  addWaitlist(entry: Omit<WaitlistEntry, "id" | "locationId" | "status" | "priority" | "createdAt">): Promise<WaitlistEntry>;
  updateWaitlist(id: string, status: WaitlistEntry["status"]): Promise<WaitlistEntry>;
  listWaitlist(): Promise<WaitlistEntry[]>;
  listCustomers(): Promise<Customer[]>;
  recordVoiceEscalation(input: VoiceEscalationInput): Promise<VoiceCall>;
  listCalls(): Promise<VoiceCall[]>;
  listEvents(): Promise<ReservationEvent[]>;
}
