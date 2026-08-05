import { z } from "zod";
import { isRestaurantLead, roles } from "@/config/permissions";
import { DomainError } from "@/domains/bookings/errors";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { databaseIdSchema } from "@/validators/booking";

const staffUpdateSchema = z.object({
  staffId: databaseIdSchema,
  role: z.enum(roles).exclude(["owner"]),
  status: z.enum(["active", "invited", "suspended"]),
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("staff:write");
    const parsed = staffUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    if (parsed.data.staffId === session.id && parsed.data.status !== "active") throw new DomainError("SELF_SUSPENSION", "Non puoi sospendere il tuo account mentre lo stai usando.", 409);
    if (parsed.data.staffId === session.id && parsed.data.role !== session.role) throw new DomainError("SELF_ROLE_CHANGE", "Non puoi modificare il tuo ruolo mentre lo stai usando.", 409);
    if (parsed.data.role === "administrator" && !isRestaurantLead(session.role)) throw new DomainError("LEAD_ROLE_REQUIRED", "Solo il proprietario o un amministratore del ristorante può assegnare questo ruolo.", 403);
    const location = getAdminLocationFromRequest(request, session);
    if (session.demo || !isSupabaseConfigured()) return success({ ...parsed.data, status: "sandbox" });

    const db = getSupabaseAdmin();
    const { data: current, error: currentError } = await db.from("staff_users").select("id,staff_user_roles(location_id,role:roles(name))").eq("id", parsed.data.staffId).eq("organization_id", session.organizationId).single();
    if (currentError) throw currentError;
    const assignments = current.staff_user_roles as unknown as Array<{ location_id: string | null; role: { name: string } | null }>;
    if (assignments.some((assignment) => assignment.role?.name === "owner")) throw new DomainError("OWNER_PROTECTED", "Il ruolo proprietario non può essere modificato da questa schermata.", 409);
    // Nessuna eccezione per un profilo centrale: quel profilo non esiste più,
    // e un account di un'altra sede non si tocca da qui.
    if (!assignments.some((assignment) => assignment.location_id === location.id)) throw new DomainError("STAFF_LOCATION_FORBIDDEN", "Questo account non appartiene alla sede selezionata.", 403);

    const { data: role, error: roleError } = await db.from("roles").select("id").eq("name", parsed.data.role).single();
    if (roleError) throw roleError;
    const { error: updateError } = await db.rpc("update_staff_access", {
      p_staff_id: parsed.data.staffId,
      p_organization_id: session.organizationId,
      p_location_id: location.id,
      p_role_id: role.id,
      p_status: parsed.data.status,
    });
    if (updateError) throw updateError;
    return success({ ...parsed.data, status: parsed.data.status });
  } catch (error) {
    return failure(error);
  }
}
