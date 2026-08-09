import { restaurantLocations } from "@/config/brand";
import { emailSenderConfigured } from "@/config/email-sender";
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
  // Un mittente per sede: se ne manca uno, quel ristorante non spedisce e
  // l'altro sì. Un unico "ready" complessivo nasconderebbe esattamente il caso
  // che ci interessa, cioè metà del personale chiuso fuori.
  const senderBySlug = Object.fromEntries(
    restaurantLocations.map((restaurant) => [restaurant.slug, emailSenderConfigured(restaurant)]),
  );
  const everySenderReady = Object.values(senderBySlug).every(Boolean);
  const guestEmailReady = Boolean(process.env.RESEND_API_KEY) && everySenderReady;
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
      // Il recupero password ha bisogno di due cose distinte: un posto dove
      // scrivere la password nuova (il database) e un modo per far arrivare
      // il link (l'email). Se manca l'email il modulo accetta la richiesta e
      // non succede niente — un guasto che si scopre solo quando qualcuno
      // resta chiuso fuori.
      staffPasswordReset: !postgresReady && !demoMode
        ? "database_required"
        : guestEmailReady ? "ready" : demoMode ? "sandbox" : "configuration_required",
    },
    // Quale sede può spedire e quale no, per nome: è la differenza fra "il
    // recupero password non va" e "il recupero password di Portici non va".
    emailSenders: { apiKey: Boolean(process.env.RESEND_API_KEY) ? "ready" : "configuration_required", byRestaurant: senderBySlug },
    timestamp: new Date().toISOString(),
  });
}
