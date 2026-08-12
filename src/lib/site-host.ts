import "server-only";

import { headers } from "next/headers";
import { restaurantForHost } from "@/config/domains";
import type { RestaurantLocation } from "@/config/brand";

/**
 * Il ristorante il cui sito vive su questo dominio, o `null`.
 *
 * `null` significa "qui il sito non c'è": o il dominio non è dedicato a una
 * sede, o quella sede non ha ancora il sito pubblicato. Le pagine del sito lo
 * usano per mostrare un 404 pulito dove il sito non esiste.
 */
export async function siteRestaurant(): Promise<RestaurantLocation | null> {
  const host = (await headers()).get("host");
  const restaurant = restaurantForHost(host);
  return restaurant?.sitePublished ? restaurant : null;
}
