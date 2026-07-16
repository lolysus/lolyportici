import { z } from "zod";
import { roles } from "@/config/permissions";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { PermissionDeniedError } from "@/domains/bookings/errors";

const inviteSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.email(),
  role: z.enum(roles).exclude(["owner"]),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("staff:write");
    const parsed = inviteSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    if (parsed.data.role === "administrator" && !session.centralAccess) throw new PermissionDeniedError();
    const location = getAdminLocationFromRequest(request, session);
    if (session.demo || !isSupabaseConfigured()) return success({ status: "sandbox" }, { status: 202 });

    const db = getSupabaseAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const { data: invitation, error: inviteError } = await db.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        redirectTo: `${appUrl}/auth/update-password`,
        data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
      },
    );
    if (inviteError || !invitation.user) throw inviteError ?? new Error("Supabase Auth did not return the invited user.");
    const { data: staff, error: staffError } = await db.from("staff_users").upsert({
      organization_id: session.organizationId,
      default_location_id: location.id,
      auth_user_id: invitation.user.id,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      status: "invited",
    }, { onConflict: "auth_user_id" }).select("id").single();
    if (staffError) throw staffError;
    const { data: role, error: roleError } = await db.from("roles").select("id").eq("name", parsed.data.role).single();
    if (roleError) throw roleError;
    const { error: assignmentError } = await db.from("staff_user_roles").upsert({
      staff_user_id: staff.id,
      role_id: role.id,
      location_id: location.id,
    });
    if (assignmentError) throw assignmentError;
    return success({ status: "invited", id: staff.id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
