import { isSupabaseConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !isSupabaseConfigured();
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER ?? "";
  const managementTokensReady = pepper.length >= 32 && !pepper.startsWith("replace-with-") && pepper !== "demo-only-pepper";
  const ready = !demoMode && managementTokensReady;
  return Response.json({
    status: ready || demoMode ? "ok" : "degraded",
    readiness: demoMode ? "sandbox" : ready ? "ready" : "configuration_required",
    mode: demoMode ? "demo" : "supabase",
    persistence: demoMode ? "ephemeral" : "durable",
    checks: {
      database: demoMode ? "sandbox" : "ready",
      managementTokens: managementTokensReady ? "ready" : demoMode ? "sandbox" : "configuration_required",
    },
    timestamp: new Date().toISOString(),
  });
}
