import { assertCustomerCanCancelReservation, assertCustomerCanModifyReservation } from "@/domains/bookings/customer-reservation-policy";
import { DomainError, ReservationNotFoundError } from "@/domains/bookings/errors";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { formatTimeInZone, localDateTimeToUtc } from "@/lib/datetime";
import { findReservationForManagementToken } from "@/lib/public-reservation";
import { reservationUpdateSchema } from "@/validators/booking";

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export async function GET(request: Request, context: RouteContext<"/api/public/v1/reservations/manage/[token]">) {
  try {
    enforceRateLimit(request, "manage-get", 40);
    const { token } = await context.params;
    const match = await findReservationForManagementToken(token);
    if (!match) throw new ReservationNotFoundError();
    return success(match.reservation);
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: RouteContext<"/api/public/v1/reservations/manage/[token]">) {
  try {
    enforceRateLimit(request, "manage-patch", 12);
    const { token } = await context.params;
    const match = await findReservationForManagementToken(token);
    if (!match) throw new ReservationNotFoundError();
    const settings = await getRestaurantSettings(match.location.id);
    if (!settings.features.customerModificationEnabled) throw new DomainError("CUSTOMER_MODIFICATION_DISABLED", "Le modifiche online non sono attive. Contatta il ristorante.", 409);
    assertCustomerCanModifyReservation(match.reservation);

    const parsed = reservationUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const current = match.reservation;
    const changes: { partySize?: number; reservationDate?: string; startAt?: string; customerNotes?: string; customer?: typeof current.customer } = {};
    if (hasOwn(parsed.data, "partySize")) changes.partySize = parsed.data.partySize;
    if (hasOwn(parsed.data, "customerNotes")) changes.customerNotes = parsed.data.customerNotes;
    if (hasOwn(parsed.data, "allergies") || hasOwn(parsed.data, "accessibilityNeeds")) {
      changes.customer = {
        ...current.customer,
        ...(hasOwn(parsed.data, "allergies") ? { allergies: parsed.data.allergies || undefined } : {}),
        ...(hasOwn(parsed.data, "accessibilityNeeds") ? { accessibilityNeeds: parsed.data.accessibilityNeeds || undefined } : {}),
      };
    }
    if (hasOwn(parsed.data, "date") || hasOwn(parsed.data, "requestedTime")) {
      const date = parsed.data.date ?? current.reservationDate;
      const time = parsed.data.requestedTime ?? formatTimeInZone(current.startAt, match.location.timezone);
      changes.startAt = localDateTimeToUtc(date, time, match.location.timezone).toISOString();
      changes.reservationDate = date;
    }
    const reservation = await match.repository.updateReservationByToken(token, changes);
    return success(reservation);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request, context: RouteContext<"/api/public/v1/reservations/manage/[token]">) {
  try {
    enforceRateLimit(request, "manage-delete", 8);
    const { token } = await context.params;
    const match = await findReservationForManagementToken(token);
    if (!match) throw new ReservationNotFoundError();
    if (match.reservation.status === "cancelled_by_customer") return success(match.reservation);
    const settings = await getRestaurantSettings(match.location.id);
    if (!settings.features.customerCancellationEnabled) throw new DomainError("CUSTOMER_CANCELLATION_DISABLED", "Le cancellazioni online non sono attive. Contatta il ristorante.", 409);
    assertCustomerCanCancelReservation(match.reservation);
    const cancellationDeadline = new Date(match.reservation.startAt).getTime() - settings.policies.cancellationDeadlineHours * 60 * 60 * 1000;
    if (Date.now() >= cancellationDeadline) throw new DomainError("CANCELLATION_DEADLINE_PASSED", "Il termine per la cancellazione online è scaduto. Contatta il ristorante.", 409);
    const body = await request.json().catch(() => ({})) as { reason?: string };
    const reservation = await match.repository.cancelReservationByToken(token, body.reason);
    return success(reservation);
  } catch (error) { return failure(error); }
}
