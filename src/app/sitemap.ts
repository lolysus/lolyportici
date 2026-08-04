import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { restaurantForHost } from "@/config/domains";
import { managedRestaurants, restaurantConfig } from "@/config/brand";
import { getRequestUrl, getBookingPath } from "@/lib/public-url";

/**
 * On a dedicated domain the other restaurant's booking page returns 404 (the
 * proxy hides it on purpose). Listing it in this domain's sitemap would tell
 * Google to crawl a URL that doesn't exist here — worse than not listing it
 * at all. So the sitemap has to know which restaurant, if any, owns the host
 * it's being served from, and only describe that one.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const defaultLocale = restaurantConfig.defaultLocale;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() || requestHeaders.get("host");
  const dedicated = restaurantForHost(host);
  const restaurants = dedicated ? [dedicated] : managedRestaurants;

  const restaurantEntries = await Promise.all(restaurants.map(async (restaurant) => ({
    url: await getRequestUrl(getBookingPath(defaultLocale, restaurant)),
    changeFrequency: "daily" as const,
    priority: 1,
    alternates: {
      languages: Object.fromEntries(await Promise.all(restaurantConfig.supportedLocales.map(async (locale) => [locale, await getRequestUrl(getBookingPath(locale, restaurant))] as const))),
    },
  })));

  // La pagina di scelta fra i due locali non esiste sui domini dedicati: lì
  // non c'è nulla da scegliere, arriva già un solo ristorante.
  if (dedicated) return restaurantEntries;

  return [
    {
      url: await getRequestUrl(getBookingPath(defaultLocale)),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(await Promise.all(restaurantConfig.supportedLocales.map(async (locale) => [locale, await getRequestUrl(getBookingPath(locale))] as const))),
      },
    },
    ...restaurantEntries,
  ];
}
