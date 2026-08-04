import { headers } from "next/headers";
import type { RestaurantLocation } from "@/config/brand";

// Safe fallback for when neither a request context nor NEXT_PUBLIC_APP_URL
// is available (e.g. a build-time static pass). Not meant to appear in
// anything Google actually crawls — getRequestOrigin covers every real
// request, on the shared host and on each restaurant's own domain alike.
const fallbackPublicAppUrl = "https://lolyportici.vercel.app";

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

/**
 * The host a request actually arrived on. Two restaurants, two domains: a
 * canonical tag or sitemap entry built from a single static base URL is
 * wrong on whichever domain it doesn't match. This reads the real Host
 * header per request, so YUKO's pages canonicalize to yukoardea.it, KouSushi's
 * to kousushiportici.it, and everything else to whatever shared host served
 * it — no per-domain branching needed anywhere that calls it.
 */
export async function getRequestOrigin() {
  try {
    const list = await headers();
    const forwardedHost = list.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || list.get("host");
    if (host) {
      const proto = list.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${proto}://${host}`;
    }
  } catch {
    // headers() throws outside a request context, e.g. during build-time
    // static analysis. Fall through to the static fallback.
  }
  return getPublicAppUrl();
}

export async function getRequestUrl(pathname: string) {
  return new URL(pathname, `${await getRequestOrigin()}/`).toString();
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
