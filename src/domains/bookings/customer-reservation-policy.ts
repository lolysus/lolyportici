import { ReservationCancellationNotAllowedError, ReservationModificationNotAllowedError } from "@/domains/bookings/errors";
import type { PublicReservation } from "@/repositories/repository";

const customerManageableStatuses = new Set(["confirmed", "modified"]);

export function canCustomerManageReservation(reservation: Pick<PublicReservation, "status">) {
  return customerManageableStatuses.has(reservation.status);
}

export function assertCustomerCanModifyReservation(reservation: Pick<PublicReservation, "status">) {
  if (!canCustomerManageReservation(reservation)) throw new ReservationModificationNotAllowedError();
}

export function assertCustomerCanCancelReservation(reservation: Pick<PublicReservation, "status">) {
  if (!canCustomerManageReservation(reservation)) throw new ReservationCancellationNotAllowedError();
}
