import { getRestaurantLocationBySlug, restaurantLocations, type RestaurantLocation } from "@/config/brand";

/**
 * Mappa dominio → ristorante.
 *
 * YUKO e KouSushi sono due attività distinte: ognuna avrà il proprio dominio e
 * su quel dominio l'altra non deve esistere, né come link né come pagina
 * raggiungibile. La mappa vive in una variabile d'ambiente perché i domini
 * cambiano senza che debba cambiare il codice.
 *
 * Formato, separato da virgole:
 *   NEXT_PUBLIC_RESTAURANT_DOMAINS="yuko.it=yuko,www.yuko.it=yuko,kousushi.it=kousushi"
 *
 * Se la variabile è vuota nessun dominio è dedicato e l'applicazione si
 * comporta come oggi, servendo entrambi i ristoranti sotto lo stesso host.
 */
export function restaurantDomainMap(): ReadonlyMap<string, RestaurantLocation> {
  const raw = process.env.NEXT_PUBLIC_RESTAURANT_DOMAINS?.trim();
  const map = new Map<string, RestaurantLocation>();
  if (!raw) return map;

  for (const entry of raw.split(",")) {
    const [host, slug] = entry.split("=").map((part) => part?.trim().toLowerCase());
    if (!host || !slug) continue;
    const restaurant = getRestaurantLocationBySlug(slug);
    if (restaurant) map.set(normalizeHost(host), restaurant);
  }
  return map;
}

/** Toglie la porta e il punto finale: `yuko.it:3000` e `yuko.it.` sono lo stesso host. */
export function normalizeHost(host: string) {
  return host.toLowerCase().replace(/\.$/, "").split(":")[0];
}

export function restaurantForHost(host: string | null | undefined): RestaurantLocation | null {
  if (!host) return null;
  return restaurantDomainMap().get(normalizeHost(host)) ?? null;
}

/** I ristoranti diversi da quello del dominio: le loro pagine vanno nascoste. */
export function foreignRestaurantSlugs(current: RestaurantLocation) {
  return restaurantLocations
    .filter((restaurant) => restaurant.slug !== current.slug)
    .map((restaurant) => restaurant.slug);
}
