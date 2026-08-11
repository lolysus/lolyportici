import { assertSameOrigin, failure, success } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getRestaurantLocationById } from "@/config/brand";
import { sendPushToLocation } from "@/lib/push/web-push-service";

/**
 * Manda una notifica di prova alla sede della sessione.
 *
 * Serve a chi ha appena acceso le notifiche per vedere subito che arrivano
 * davvero, prima che entri la prima prenotazione vera. Passa dalla stessa
 * catena delle notifiche reali — non un percorso finto — così una prova
 * riuscita significa che anche quelle vere arriveranno.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("reservations:read");
    const location = getRestaurantLocationById(session.locationId);
    const result = await sendPushToLocation(session.locationId, {
      title: `Notifiche attive · ${location?.shortName ?? "Regia"}`,
      body: "Le notifiche funzionano: le nuove prenotazioni arriveranno qui.",
      url: location ? `/admin/${location.slug}/reservations` : "/",
      tag: "push-test",
      icon: location ? `/brands/${location.slug}-icon-192.png` : undefined,
    });
    return success(result);
  } catch (error) { return failure(error); }
}
