import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { waitlistSchema } from "@/validators/booking";
import { localDateTimeToUtc } from "@/lib/datetime";
import { DomainError } from "@/domains/bookings/errors";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getRestaurantLocationById } from "@/config/brand";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "waitlist", 15);
    const parsed = waitlistSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const settings = await getRestaurantSettings(location.id);
    if (!settings.features.waitlistEnabled) throw new DomainError("WAITLIST_DISABLED", "La lista d’attesa non è attiva in questo momento.", 409);
    const { locationId: _locationId, firstName, lastName, phone, requestedTime, ...rest } = parsed.data;
    void _locationId;
    const entry = await getRepository(location.id).addWaitlist({ ...rest, customer: { firstName, lastName, phone }, requestedStartAt: localDateTimeToUtc(rest.requestedDate, requestedTime, location.timezone).toISOString() });
    return success(entry, { status: 201 });
  } catch (error) { return failure(error); }
}
