import { getRestaurantLocationBySlug, restaurantLocations, type RestaurantLocation } from "@/config/brand";

/**
 * Porta di servizio: un percorso riservato per ogni ristorante.
 *
 * YUKO e KouSushi non entrano dalla stessa pagina dei clienti. Ognuno ha un
 * indirizzo suo, che non è linkato da nessuna pagina pubblica e si conosce
 * solo se qualcuno te lo manda. Chi lavora a Portici non ha motivo di sapere
 * come si entra ad Ardea, e viceversa.
 *
 * Non è una misura di sicurezza da sola — le credenziali e i permessi restano
 * l'unico vero controllo — ma toglie di mezzo l'errore più banale: lo staff di
 * una sede che finisce nel pannello dell'altra perché il link era lo stesso.
 *
 * I percorsi si cambiano senza toccare il codice, per esempio se uno gira di
 * mano in mano più del dovuto:
 *   ADMIN_ACCESS_PATHS="yuko=ardea-9f21c7,kousushi=portici-4b83de"
 */
const fallbackAccessKeys: Record<string, string> = {
  yuko: "ardea-yuko-7c41f9",
  kousushi: "portici-kou-3e98ba",
};

function configuredAccessKeys(): ReadonlyMap<string, string> {
  const keys = new Map<string, string>();
  const raw = process.env.ADMIN_ACCESS_PATHS?.trim();
  if (raw) {
    for (const entry of raw.split(",")) {
      const [slug, key] = entry.split("=").map((part) => part?.trim().toLowerCase());
      if (slug && key && getRestaurantLocationBySlug(slug)) keys.set(slug, key);
    }
  }
  for (const restaurant of restaurantLocations) {
    if (!keys.has(restaurant.slug)) keys.set(restaurant.slug, fallbackAccessKeys[restaurant.slug] ?? restaurant.slug);
  }
  return keys;
}

/** Il segmento riservato di questo ristorante, senza barre. */
export function adminAccessKey(restaurant: RestaurantLocation) {
  return configuredAccessKeys().get(restaurant.slug) ?? restaurant.slug;
}

/** Il percorso completo da consegnare al ristorante. */
export function adminAccessPath(restaurant: RestaurantLocation) {
  return `/gestione/${adminAccessKey(restaurant)}`;
}

export function restaurantForAccessKey(key: string | undefined | null) {
  if (!key) return null;
  const normalized = key.trim().toLowerCase();
  for (const [slug, value] of configuredAccessKeys()) {
    if (value === normalized) return getRestaurantLocationBySlug(slug) ?? null;
  }
  return null;
}
