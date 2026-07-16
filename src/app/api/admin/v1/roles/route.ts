import { z } from "zod";
import { permissions, roles } from "@/config/permissions";
import { DomainError } from "@/domains/bookings/errors";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

const roleSchema = z.object({
  role: z.enum(roles).exclude(["owner"]),
  permissions: z.array(z.enum(permissions)).min(1),
});

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("staff:write");
    if (!session.centralAccess) throw new DomainError("CENTRAL_ACCESS_REQUIRED", "Solo la regia centrale può modificare la matrice dei permessi.", 403);
    const parsed = roleSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    if (parsed.data.role === session.role && !parsed.data.permissions.includes("staff:write")) {
      throw new DomainError("SELF_PERMISSION_LOCKOUT", "Non puoi rimuovere dal tuo ruolo il permesso di gestione accessi.", 409);
    }
    if (session.demo || !isSupabaseConfigured()) return success({ ...parsed.data, status: "sandbox" });
    const { data, error } = await getSupabaseAdmin().from("roles").update({ permissions: parsed.data.permissions }).eq("name", parsed.data.role).select("name,permissions").single();
    if (error) throw error;
    return success(data);
  } catch (error) {
    return failure(error);
  }
}
