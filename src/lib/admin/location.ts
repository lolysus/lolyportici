import "server-only";

import { cookies, headers } from "next/headers";
import { defaultRestaurantLocation, getRestaurantLocationBySlug, restaurantLocations } from "@/config/brand";
import { adminLocationCookie, adminLocationCookieOptions, adminRestaurantHeader } from "@/lib/admin/location-cookie";
import { getCurrentStaffSession } from "@/lib/auth/dal";
import type { StaffSession } from "@/types/domain";

export { adminLocationCookie, adminLocationCookieOptions, adminRestaurantHeader };

export function getAccessibleAdminLocations(session: StaffSession) {
  return restaurantLocations.filter((location) => session.accessibleLocationIds.includes(location.id));
}

export function canAccessAdminLocation(session: StaffSession, locationId: string) {
  return session.accessibleLocationIds.includes(locationId);
}

function fallbackLocation(session?: StaffSession | null) {
  if (!session) return defaultRestaurantLocation;
  return restaurantLocations.find((location) => location.id === session.locationId)
    ?? getAccessibleAdminLocations(session)[0]
    ?? defaultRestaurantLocation;
}

/**
 * Il ristorante nell'indirizzo, se l'indirizzo ne nomina uno.
 *
 * `/admin/yuko/prenotazioni` deve mostrare YUKO subito, non dalla richiesta
 * successiva: per questo l'intestazione messa dal proxy batte il cookie.
 */
export async function getScopedAdminRestaurant() {
  const slug = (await headers()).get(adminRestaurantHeader);
  return slug ? getRestaurantLocationBySlug(slug) ?? null : null;
}

export async function getActiveAdminLocation(providedSession?: StaffSession) {
  const session = providedSession ?? await getCurrentStaffSession();
  const scoped = await getScopedAdminRestaurant();
  if (scoped) return session && canAccessAdminLocation(session, scoped.id) ? scoped : fallbackLocation(session);
  const cookieStore = await cookies();
  const selectedSlug = cookieStore.get(adminLocationCookie)?.value;
  const selected = selectedSlug ? getRestaurantLocationBySlug(selectedSlug) : undefined;
  return selected && session && canAccessAdminLocation(session, selected.id) ? selected : fallbackLocation(session);
}

/**
 * La sede su cui agisce una chiamata alle API di gestione.
 *
 * Qui si guarda il **cookie**, non l'intestazione del proxy: quell'intestazione
 * esiste solo sulle richieste di pagina sotto `/gestione/...`, e il proxy la
 * cancella da tutto il resto perché altrimenti chiunque potrebbe scegliersi il
 * ristorante a mano. Le chiamate API non passano da quel prefisso, quindi la
 * sede la leggono dal cookie, che il proxy riallinea a ogni caricamento della
 * pagina.
 *
 * In ogni caso la sede viene confrontata con quelle accessibili alla sessione, e
 * l'identificativo del ristorante non arriva **mai** dal corpo della richiesta:
 * quello lo controlla il client, e il client non decide su cosa può scrivere.
 */
export function getAdminLocationFromRequest(request: Request | undefined, session: StaffSession) {
  const cookieHeader = request?.headers.get("cookie") ?? "";
  const selectedSlug = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${adminLocationCookie}=`))?.slice(adminLocationCookie.length + 1);
  const decodedSlug = selectedSlug ? decodeURIComponent(selectedSlug) : undefined;
  const selected = decodedSlug ? getRestaurantLocationBySlug(decodedSlug) : undefined;
  return selected && canAccessAdminLocation(session, selected.id) ? selected : fallbackLocation(session);
}
