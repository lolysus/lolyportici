import type { ReservationSource } from "@/types/domain";

export interface AvailabilityInput {
  locationId: string;
  date: string;
  requestedTime?: string;
  partySize: number;
  preferredAreaId?: string;
  requestedDuration?: number;
  source: ReservationSource;
  accessibilityRequirements?: boolean;
  tablePreferenceId?: string;
}

export interface AvailabilityOption {
  startAt: string;
  endAt: string;
  durationMinutes: number;
  diningArea: { id: string; name: string };
  tableIds: string[];
  combinationId?: string;
  score: number;
  availabilityReason: string;
}

export interface AvailabilityResult {
  requestedSlotAvailable: boolean;
  availableOptions: AvailabilityOption[];
  alternativeSlots: AvailabilityOption[];
  restrictions: string[];
  requiresManualApproval: boolean;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details: Record<string, unknown> };
}

export type ApiSuccess<T> = { success: true; data: T };

