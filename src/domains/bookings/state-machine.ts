import { InvalidReservationStateError } from "@/domains/bookings/errors";
import type { ReservationStatus } from "@/types/domain";

const transitions: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
  draft: ["held", "pending_approval"],
  held: ["confirmed", "expired"],
  pending_confirmation: ["confirmed", "cancelled_by_customer", "expired"],
  pending_approval: ["confirmed", "cancelled_by_restaurant"],
  confirmed: ["modified", "arriving", "late", "arrived", "cancelled_by_customer", "cancelled_by_restaurant"],
  modified: ["arriving", "late", "arrived", "cancelled_by_customer", "cancelled_by_restaurant"],
  arriving: ["arrived", "late", "cancelled_by_customer", "cancelled_by_restaurant"],
  late: ["arrived", "no_show", "cancelled_by_restaurant"],
  arrived: ["seated", "cancelled_by_restaurant"],
  seated: ["completed"],
  waitlisted: ["offered", "cancelled_by_customer"],
  offered: ["confirmed", "expired"],
};

export function canTransition(from: ReservationStatus, to: ReservationStatus) {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: ReservationStatus, to: ReservationStatus) {
  if (!canTransition(from, to)) throw new InvalidReservationStateError(from, to);
}

export { transitions as reservationTransitions };

