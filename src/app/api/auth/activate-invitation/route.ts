import { DomainError } from "@/domains/bookings/errors";
import { assertSameOrigin, failure, success } from "@/lib/api/response";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!isSupabaseConfigured()) return success({ status: "sandbox" });

    const supabase = await getSupabaseServerClient();
    if (!supabase) throw new DomainError("AUTH_SERVICE_UNAVAILABLE", "Servizio di autenticazione non disponibile.", 503);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new DomainError("INVITATION_SESSION_REQUIRED", "Sessione di invito non valida o scaduta.", 401);

    const db = getSupabaseAdmin();
    const { data: staff, error: staffError } = await db
      .from("staff_users")
      .select("id,status")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (staffError) throw staffError;
    if (!staff) throw new DomainError("STAFF_PROFILE_NOT_FOUND", "Profilo staff non trovato.", 404);
    if (staff.status === "suspended") throw new DomainError("STAFF_ACCESS_SUSPENDED", "Questo accesso è sospeso. Contatta un amministratore.", 403);

    if (staff.status === "invited") {
      const { error } = await db.from("staff_users").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", staff.id);
      if (error) throw error;
    }

    return success({ status: "active" });
  } catch (error) {
    return failure(error);
  }
}
