import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { holdReleaseSchema, holdSchema } from "@/validators/booking";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";

function publicHoldInput(body: unknown) {
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const requestedLocationId = typeof input.locationId === "string" && getRestaurantLocationById(input.locationId) ? input.locationId : restaurantConfig.locationId;
  return {
    locationId: requestedLocationId,
    date: input.date,
    requestedTime: input.requestedTime,
    partySize: input.partySize,
    requestedDuration: input.requestedDuration,
    accessibilityRequirements: input.accessibilityRequirements === true,
    startAt: input.startAt,
    sessionId: input.sessionId,
    tableSelectionId: input.tableSelectionId,
    source: "web" as const,
  };
}

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "holds", 30);
    const parsed = holdSchema.safeParse(publicHoldInput(await request.json()));
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    const { startAt, sessionId, tableSelectionId, ...availability } = parsed.data;
    const hold = await getRepository(location.id).createHold({ availability, startAt, sessionId, tableSelectionId });
    return success(hold, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    enforceRateLimit(request, "hold-release", 30);
    const parsed = holdReleaseSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });
    await getRepository(location.id).releaseHold(parsed.data.holdId, parsed.data.sessionId);
    return success({ released: true });
  } catch (error) { return failure(error); }
}
