import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { publicWaitlistSchema } from "@/validators/booking";
import { dateKeyInZone, localDateTimeToUtc } from "@/lib/datetime";
import { DomainError } from "@/domains/bookings/errors";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getRestaurantLocationById } from "@/config/brand";

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "waitlist", 15);
    const body = await request.json();
    const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
    const { preferredAreaId: _preferredAreaId, ...publicInput } = input;
    void _preferredAreaId;
    const parsed = publicWaitlistSchema.safeParse(publicInput);
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const settings = await getRestaurantSettings(location.id);
    if (!settings.features.waitlistEnabled) throw new DomainError("WAITLIST_DISABLED", "La lista d’attesa non è attiva in questo momento.", 409);
    const repository = getRepository(location.id);
    const availability = await repository.getAvailabilityContext();
    const today = dateKeyInZone(new Date(), location.timezone);
    const advance = Math.round((Date.parse(`${parsed.data.requestedDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000);
    if (availability.locationAvailable === false || advance < 0 || advance > (availability.bookingConstraints?.maximumAdvanceDays ?? settings.policies.maximumAdvanceDays)) {
      throw new DomainError("WAITLIST_DATE_NOT_AVAILABLE", "La data selezionata non accetta richieste in lista d’attesa.", 409);
    }
    if (parsed.data.partySize < (availability.bookingConstraints?.minimumPartySize ?? settings.rules.minimumPartySize)) {
      throw new DomainError("WAITLIST_PARTY_TOO_SMALL", "Il numero di ospiti è inferiore al minimo accettato.", 422);
    }
    const { locationId: _locationId, privacyConsent: _privacyConsent, firstName, lastName, phone, requestedTime, ...rest } = parsed.data;
    void _locationId;
    void _privacyConsent;
    const entry = await repository.addWaitlist({ ...rest, customer: { firstName, lastName, phone }, requestedStartAt: localDateTimeToUtc(rest.requestedDate, requestedTime, location.timezone).toISOString() });
    return success(entry, { status: 201 });
  } catch (error) { return failure(error); }
}
