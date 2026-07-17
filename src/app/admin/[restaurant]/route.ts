import { NextResponse } from "next/server";
import { getRestaurantLocationBySlug } from "@/config/brand";
import { adminLocationCookie, adminLocationCookieOptions, canAccessAdminLocation } from "@/lib/admin/location";
import { getCurrentStaffSession } from "@/lib/auth/dal";

const allowedRestaurantSlugs = new Set(["yuko", "kousushi"]);

export async function GET(request: Request, context: { params: Promise<{ restaurant: string }> }) {
  const { restaurant: slug } = await context.params;
  const location = allowedRestaurantSlugs.has(slug) ? getRestaurantLocationBySlug(slug) : undefined;

  if (!location) return new NextResponse(null, { status: 404 });

  const session = await getCurrentStaffSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  if (!canAccessAdminLocation(session, location.id)) return NextResponse.redirect(new URL("/admin/dashboard", request.url));

  const response = NextResponse.redirect(new URL(`/admin/${location.slug}/dashboard`, request.url));
  response.cookies.set(adminLocationCookie, location.slug, adminLocationCookieOptions);
  return response;
}
