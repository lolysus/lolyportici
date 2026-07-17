import "server-only";

import { cookies } from "next/headers";
import { defaultRestaurantLocation, getRestaurantLocationBySlug, restaurantLocations } from "@/config/brand";
import { getCurrentStaffSession } from "@/lib/auth/dal";
import type { StaffSession } from "@/types/domain";

export const adminLocationCookie = "sushi_admin_location";
export const adminLocationCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

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

export async function getActiveAdminLocation(providedSession?: StaffSession) {
  const session = providedSession ?? await getCurrentStaffSession();
  const cookieStore = await cookies();
  const selectedSlug = cookieStore.get(adminLocationCookie)?.value;
  const selected = selectedSlug ? getRestaurantLocationBySlug(selectedSlug) : undefined;
  return selected && session && canAccessAdminLocation(session, selected.id) ? selected : fallbackLocation(session);
}

export function getAdminLocationFromRequest(request: Request | undefined, session: StaffSession) {
  const cookieHeader = request?.headers.get("cookie") ?? "";
  const selectedSlug = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${adminLocationCookie}=`))?.slice(adminLocationCookie.length + 1);
  const decodedSlug = selectedSlug ? decodeURIComponent(selectedSlug) : undefined;
  const selected = decodedSlug ? getRestaurantLocationBySlug(decodedSlug) : undefined;
  return selected && canAccessAdminLocation(session, selected.id) ? selected : fallbackLocation(session);
}
