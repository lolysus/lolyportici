import type { RestaurantLocation } from "@/config/brand";

// Safe fallback for the dedicated Loly production project. Set
// NEXT_PUBLIC_APP_URL to the definitive custom domain before the public launch.
const fallbackPublicAppUrl = "https://loly-gules.vercel.app";

export function getPublicAppUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) return fallbackPublicAppUrl;

  try {
    return new URL(configured).origin;
  } catch {
    return fallbackPublicAppUrl;
  }
}

export function getPublicUrl(pathname: string) {
  return new URL(pathname, `${getPublicAppUrl()}/`).toString();
}

export function getBookingPath(locale: string, restaurant?: Pick<RestaurantLocation, "slug">) {
  return restaurant ? `/${locale}/book/${restaurant.slug}` : `/${locale}/book`;
}

export function getPublicBookingUrl(locale: string, restaurant?: Pick<RestaurantLocation, "slug">) {
  return getPublicUrl(getBookingPath(locale, restaurant));
}

export function getGoogleMapsDirectionsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
