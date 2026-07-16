import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { sendReservationConfirmation } from "@/domains/notifications/notification-service";
import { reservationCreateSchema } from "@/validators/booking";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getRestaurantLocationById, defaultRestaurantLocation } from "@/config/brand";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "reservations", 20);
    const parsed = reservationCreateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = parsed.data.locationId ? getRestaurantLocationById(parsed.data.locationId) : defaultRestaurantLocation;
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const { locationId: _locationId, ...confirmation } = parsed.data;
    void _locationId;
    const result = await getRepository(location.id).confirmHold(confirmation);
    const settings = await getRestaurantSettings(location.id);
    const notification = settings.features.automaticNotificationsEnabled
      ? await sendReservationConfirmation(result.reservation, {
        emailEnabled: settings.notifications.emailConfirmationEnabled,
        smsEnabled: settings.notifications.smsConfirmationEnabled,
      }).catch((error: unknown) => ({ status: "failed" as const, error: error instanceof Error ? error.message : "Unknown notification error" }))
      : { status: "disabled" as const, attempts: 0 };
    return success({ ...result, notification }, { status: 201 });
  } catch (error) { return failure(error); }
}
