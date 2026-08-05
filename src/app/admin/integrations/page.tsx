import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Database,
  Mail,
  MessageCircle,
  Phone,
  ServerCog,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { BookingLinksPanel } from "@/components/admin/booking-links-panel";
import { StaffAccessLinksPanel } from "@/components/admin/staff-access-links-panel";
import { Badge } from "@/components/ui/badge";
import { adminAccessPath } from "@/config/admin-access";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getPublicAppUrl } from "@/lib/public-url";
import { isSupabaseConfigured } from "@/lib/supabase/admin";

const integrations = [
  {
    name: "Retell AI",
    description: "Assistente vocale e tool controllati",
    icon: Bot,
    env: ["RETELL_API_KEY", "RETELL_AGENT_ID", "RETELL_WEBHOOK_SECRET"],
  },
  {
    name: "Telnyx",
    description: "Telefonia e conferme SMS",
    icon: Phone,
    env: ["TELNYX_API_KEY", "TELNYX_MESSAGING_PROFILE_ID", "TELNYX_FROM_NUMBER"],
  },
  {
    name: "Resend",
    description: "Email transazionali multilingua",
    icon: Mail,
    env: ["RESEND_API_KEY", "EMAIL_FROM"],
  },
  {
    name: "WhatsApp Business",
    description: "Template di conferma opzionali",
    icon: MessageCircle,
    env: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"],
  },
  {
    name: "Google Calendar",
    description: "Esportazione calendario facoltativa",
    icon: CalendarDays,
    env: [
      "GOOGLE_CALENDAR_CLIENT_ID",
      "GOOGLE_CALENDAR_CLIENT_SECRET",
      "GOOGLE_CALENDAR_REFRESH_TOKEN",
      "GOOGLE_CALENDAR_ID",
    ],
  },
] as const;

export default async function IntegrationsPage() {
  const session = await requirePermission("settings:write");
  const location = await getActiveAdminLocation(session);
  const states = integrations.map((item) => ({ ...item, configured: item.env.every((key) => Boolean(process.env[key])) }));
  const activeCount = states.filter((item) => item.configured).length;
  const persistenceReady = isSupabaseConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE !== "true";
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER ?? "";
  const managementTokensReady = pepper.length >= 32 && !pepper.startsWith("replace-with-") && pepper !== "demo-only-pepper";
  const productionReady = persistenceReady && managementTokensReady;

  return (
    <>
      <PageHeading
        eyebrow="Adapter esterni"
        title="Integrazioni"
        description="Il booking base richiede solo persistenza e autenticazione. AI, SMS, WhatsApp, email e calendario restano canali opzionali."
        actions={<Badge variant={productionReady ? "default" : "outline"}>{productionReady ? <><CheckCircle2 /> Core pronto</> : <><TriangleAlert /> Database richiesto</>}</Badge>}
      />
      <BookingLinksPanel locations={[location]} configuredBaseUrl={getPublicAppUrl()} />
      <StaffAccessLinksPanel configuredBaseUrl={getPublicAppUrl()} links={[{ slug: location.slug, label: location.shortName, city: location.city, path: adminAccessPath(location) }]} />
      <div className="mb-6 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
        <ReadinessCard icon={Database} label="Persistenza" value={persistenceReady ? "Supabase attivo" : "Sandbox effimera"} ready={persistenceReady} />
        <ReadinessCard icon={ServerCog} label="Canali opzionali" value={`${activeCount} su ${states.length}`} ready={activeCount > 0} />
        <ReadinessCard icon={productionReady ? CheckCircle2 : TriangleAlert} label="Booking essenziale" value={productionReady ? "Persistente e autenticato" : persistenceReady ? "Secret token richiesto" : "Demo locale"} ready={productionReady} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {states.map((item) => {
          const configured = item.configured;
          return (
            <article key={item.name} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <Badge variant={configured ? "default" : "outline"}>
                  {configured ? <><CheckCircle2 /> Attiva</> : "Sandbox"}
                </Badge>
              </div>
              <h2 className="mt-5 font-heading text-xl">{item.name}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              <details className="group mt-5 rounded-lg border bg-background/40">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium">
                  <SlidersHorizontal className="size-4" />
                  Variabili richieste
                </summary>
                <div className="space-y-2 border-t px-3 py-3">
                  {item.env.map((key) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <code className="truncate text-[11px] text-muted-foreground">{key}</code>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {process.env[key] ? "presente" : "mancante"}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ReadinessCard({ icon: Icon, label, value, ready }: { icon: typeof Database; label: string; value: string; ready: boolean }) {
  return <div className="bg-card p-5"><div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground"><Icon className="size-4" />{label}</div><p className={ready ? "mt-3 font-heading text-xl text-primary" : "mt-3 font-heading text-xl"}>{value}</p></div>;
}
