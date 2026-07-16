import { DomainError, ReservationNotFoundError } from "@/domains/bookings/errors";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { reservationUpdateSchema } from "@/validators/booking";
import { formatTimeInZone, localDateTimeToUtc } from "@/lib/datetime";
import { findReservationForManagementToken } from "@/lib/public-reservation";

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
    const parsed = reservationUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const current = match.reservation;
    const changes: Partial<typeof current> = { customerNotes: parsed.data.customerNotes };
    if (parsed.data.partySize) changes.partySize = parsed.data.partySize;
    if (parsed.data.date || parsed.data.requestedTime) {
      const date = parsed.data.date ?? current.reservationDate;
      const time = parsed.data.requestedTime ?? formatTimeInZone(current.startAt);
      changes.startAt = localDateTimeToUtc(date, time).toISOString();
      changes.reservationDate = date;
    }
    if (parsed.data.allergies) changes.customer = { ...current.customer, allergies: parsed.data.allergies };
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
    const settings = await getRestaurantSettings(match.location.id);
    if (!settings.features.customerCancellationEnabled) throw new DomainError("CUSTOMER_CANCELLATION_DISABLED", "Le cancellazioni online non sono attive. Contatta il ristorante.", 409);
    const current = match.reservation;
    const cancellationDeadline = new Date(current.startAt).getTime() - settings.policies.cancellationDeadlineHours * 60 * 60 * 1000;
    if (Date.now() >= cancellationDeadline) {
      throw new DomainError(
        "CANCELLATION_DEADLINE_PASSED",
        "Il termine per la cancellazione online è scaduto. Contatta il ristorante.",
        409,
      );
    }
    const body = await request.json().catch(() => ({})) as { reason?: string };
    const reservation = await match.repository.cancelReservationByToken(token, body.reason);
    return success(reservation);
  } catch (error) { return failure(error); }
}
