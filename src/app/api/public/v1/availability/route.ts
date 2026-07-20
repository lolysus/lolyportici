import { checkAvailability } from "@/domains/availability/availability-service";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { availabilitySchema } from "@/validators/booking";
import type { AvailabilityResult, PublicAvailabilityResult } from "@/types/api";

function publicAvailabilityInput(body: unknown) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const requestedLocationId = typeof input.locationId === "string" && getRestaurantLocationById(input.locationId) ? input.locationId : restaurantConfig.locationId;
  return {
    locationId: requestedLocationId,
    date: input.date,
    requestedTime: input.requestedTime,
    partySize: input.partySize,
    source: "web" as const,
    accessibilityRequirements: input.accessibilityRequirements === true,
  };
}

function publicAvailability(result: AvailabilityResult): PublicAvailabilityResult {
  const serialize = (option: AvailabilityResult["availableOptions"][number]) => ({ startAt: option.startAt, endAt: option.endAt, durationMinutes: option.durationMinutes });
  return { ...result, availableOptions: result.availableOptions.map(serialize), alternativeSlots: result.alternativeSlots.map(serialize) };
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "availability", 90);
    const parsed = availabilitySchema.safeParse(publicAvailabilityInput(await request.json()));
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const result = checkAvailability(parsed.data, await getRepository(location.id).getAvailabilityContext());
    return success(publicAvailability(result));
  } catch (error) { return failure(error); }
}
