import type { MetadataRoute } from "next";
import { managedRestaurants, restaurantConfig } from "@/config/brand";
import { getPublicBookingUrl } from "@/lib/public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const defaultLocale = restaurantConfig.defaultLocale;

  return [
    {
      url: getPublicBookingUrl(defaultLocale),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: Object.fromEntries(restaurantConfig.supportedLocales.map((locale) => [locale, getPublicBookingUrl(locale)])),
      },
    },
    ...managedRestaurants.map((restaurant) => ({
      url: getPublicBookingUrl(defaultLocale, restaurant),
      changeFrequency: "daily" as const,
      priority: 1,
      alternates: {
        languages: Object.fromEntries(restaurantConfig.supportedLocales.map((locale) => [locale, getPublicBookingUrl(locale, restaurant)])),
      },
    })),
  ];
}
