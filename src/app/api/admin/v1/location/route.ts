import { cookies } from "next/headers";
import { z } from "zod";
import { restaurantLocations, getRestaurantLocationBySlug } from "@/config/brand";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requireStaffSession } from "@/lib/auth/dal";
import { adminLocationCookie, adminLocationCookieOptions, canAccessAdminLocation } from "@/lib/admin/location";
import { PermissionDeniedError } from "@/domains/bookings/errors";

const schema = z.object({ slug: z.enum(restaurantLocations.map((location) => location.slug) as [string, ...string[]]) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requireStaffSession();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    const location = getRestaurantLocationBySlug(parsed.data.slug);
    if (!location) return validationFailure({ slug: ["Sede non valida"] });
    if (!canAccessAdminLocation(session, location.id)) throw new PermissionDeniedError();
    const cookieStore = await cookies();
    cookieStore.set(adminLocationCookie, location.slug, adminLocationCookieOptions);
    return success(location);
  } catch (error) {
    return failure(error);
  }
}
