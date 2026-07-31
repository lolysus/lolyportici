import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { getPostgres, isPostgresConfigured } from "@/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const postgresReady = isPostgresConfigured();
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || (!postgresReady && !isSupabaseConfigured());
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER ?? "";
  const managementTokensReady = pepper.length >= 32 && !pepper.startsWith("replace-with-") && pepper !== "demo-only-pepper";
  let databaseReady = demoMode;
  if (postgresReady) {
    try { await getPostgres()`select 1`; databaseReady = true; } catch { databaseReady = false; }
  } else if (isSupabaseConfigured()) databaseReady = true;
  const guestEmailReady = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  const ready = !demoMode && managementTokensReady && databaseReady;
  return Response.json({
    status: ready || demoMode ? "ok" : "degraded",
    readiness: demoMode ? "sandbox" : ready ? "ready" : "configuration_required",
    mode: demoMode ? "demo" : postgresReady ? "railway-postgres" : "supabase",
    persistence: demoMode ? "ephemeral" : "durable",
    checks: {
      database: demoMode ? "sandbox" : databaseReady ? "ready" : "unavailable",
      managementTokens: managementTokensReady ? "ready" : demoMode ? "sandbox" : "configuration_required",
      // Senza provider email la prenotazione va a buon fine e il cliente non
      // riceve nulla: è un guasto invisibile dall'esterno, quindi va esposto.
      guestConfirmationEmail: guestEmailReady ? "ready" : demoMode ? "sandbox" : "configuration_required",
    },
    timestamp: new Date().toISOString(),
  });
}
