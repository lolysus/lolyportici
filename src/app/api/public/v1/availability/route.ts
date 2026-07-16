import { checkAvailability } from "@/domains/availability/availability-service";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { availabilitySchema } from "@/validators/booking";

function publicAvailabilityInput(body: unknown) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const requestedLocationId = typeof input.locationId === "string" && getRestaurantLocationById(input.locationId) ? input.locationId : restaurantConfig.locationId;
  return {
    ...input,
    locationId: requestedLocationId,
    source: "web" as const,
  };
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "availability", 90);
    const parsed = availabilitySchema.safeParse(publicAvailabilityInput(await request.json()));
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const result = checkAvailability(parsed.data, await getRepository(location.id).getAvailabilityContext());
    return success(result);
  } catch (error) { return failure(error); }
}
