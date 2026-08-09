import { checkAvailability, listBookableTableOptions } from "@/domains/availability/availability-service";
import { getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";
import { getRepository } from "@/repositories";
import { bookableTablesSchema } from "@/validators/booking";

/**
 * I tavoli liberi per un orario preciso.
 *
 * Sta a parte dalla disponibilità perché la domanda è diversa: la
 * disponibilità risponde "a che ora posso venire", questa risponde "dove mi
 * siedo". Calcolarli per ogni slot della serata sarebbe lavoro buttato — il
 * cliente sceglie un orario e solo di quello vuole vedere i tavoli.
 *
 * Non espone identificativi interni oltre a quello che serve per scegliere:
 * niente posizioni in pianta, niente stato operativo, niente prenotazioni.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "bookable-tables", 60);
    const body = await request.json() as Record<string, unknown>;
    const requestedLocationId = typeof body.locationId === "string" && getRestaurantLocationById(body.locationId)
      ? body.locationId
      : restaurantConfig.locationId;
    const parsed = bookableTablesSchema.safeParse({ ...body, locationId: requestedLocationId });
    if (!parsed.success) return validationFailure(parsed.error.flatten());

    const location = getRestaurantLocationById(parsed.data.locationId);
    if (!location) return validationFailure({ locationId: ["Sede non valida"] });

    const context = await getRepository(location.id).getAvailabilityContext();
    const availabilityInput = {
      locationId: location.id,
      date: parsed.data.date,
      requestedTime: formatTimeInZone(parsed.data.startAt, location.timezone),
      partySize: parsed.data.partySize,
      accessibilityRequirements: parsed.data.accessibilityRequirements === true,
      source: "web" as const,
    };
    // Passare dalle regole complete invece di guardare i soli tavoli: servizio,
    // preavviso, chiusure e capienza valgono anche qui, e una lista di tavoli
    // per un orario non prenotabile è una lista di tavoli che falliranno.
    const availability = checkAvailability(availabilityInput, context);
    const option = availability.availableOptions.find((item) => item.startAt === parsed.data.startAt);
    if (!option) return success({ startAt: parsed.data.startAt, tables: [] });

    return success({
      startAt: option.startAt,
      endAt: option.endAt,
      durationMinutes: option.durationMinutes,
      tables: listBookableTableOptions(availabilityInput, context, option.startAt, option.endAt),
    });
  } catch (error) { return failure(error); }
}
