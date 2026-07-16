import { Building2, Network, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { CentralReservationsStream } from "@/components/admin/central-reservations-stream";
import { LocationCards, type LocationSummary } from "@/components/admin/location-cards";
import { PageHeading } from "@/components/admin/page-heading";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getAccessibleAdminLocations, getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";

const operationalStatuses = new Set(["confirmed", "modified", "arriving", "late", "arrived", "seated"]);

export default async function LocationsPage() {
  const session = await requirePermission("reservations:read");
  if (!session.centralAccess) redirect("/admin/dashboard");
  const accessibleLocations = getAccessibleAdminLocations(session);
  const activeLocation = await getActiveAdminLocation(session);
  const locationData = await Promise.all(accessibleLocations.map(async (location) => {
    const repository = getRepository(location.id);
    const [reservations, waitlist, calls, settings] = await Promise.all([
      repository.listReservations(),
      repository.listWaitlist(),
      repository.listCalls(),
      getRestaurantSettings(location.id),
    ]);
    const activeReservations = reservations.filter((reservation) => operationalStatuses.has(reservation.status));
    const covers = activeReservations.reduce((total, reservation) => total + reservation.partySize, 0);
    const waiting = waitlist.filter((entry) => entry.status === "waiting").length;
    const occupancyPercent = Math.min(100, Math.round((covers / settings.service.maximumCovers) * 100));
    const daySchedule = settings.schedule.find((day) => day.dayOfWeek === dayOfWeekInZone(location.timezone));
    const serviceWindows = [
      daySchedule?.lunch.enabled ? `Pranzo ${daySchedule.lunch.startTime}–${daySchedule.lunch.endTime}` : null,
      daySchedule?.dinner.enabled ? `Cena ${daySchedule.dinner.startTime}–${daySchedule.dinner.endTime}` : null,
    ].filter(Boolean).join(" · ") || "Nessun servizio oggi";
    const summary: LocationSummary = {
      location,
      reservations: activeReservations.length,
      covers,
      waiting,
      calls: calls.length,
      operatingMode: settings.operations.serviceMode,
      occupancyPercent,
      capacityLimit: settings.service.maximumCovers,
      capacityWarningPercent: settings.operations.capacityWarningPercent,
      serviceWindows,
      attentionCount: Number(occupancyPercent >= settings.operations.capacityWarningPercent)
        + Number(settings.notifications.staffWaitlistAlertsEnabled && waiting >= settings.operations.waitlistAlertCount)
        + Number(settings.operations.serviceMode !== "live"),
    };
    return { summary, reservations };
  }));
  const summaries = locationData.map((item) => item.summary);
  const recentReservations = locationData
    .flatMap(({ summary, reservations }) => reservations.map((reservation) => ({ reservation, location: summary.location })))
    .sort((left, right) => right.reservation.createdAt.localeCompare(left.reservation.createdAt))
    .slice(0, 8);
  const totalReservations = summaries.reduce((total, summary) => total + summary.reservations, 0);
  const totalCovers = summaries.reduce((total, summary) => total + summary.covers, 0);

  return <>
    <PageHeading
      eyebrow={session.centralAccess ? "Regia multi-ristorante" : "Controllo ristorante"}
      title={accessibleLocations.length > 1 ? "I tuoi ristoranti" : accessibleLocations[0]?.shortName ?? "Il tuo ristorante"}
      description={accessibleLocations.length > 1
        ? "Una regia centrale, due ristoranti indipendenti. Scegli il ristorante per entrare nella sua dashboard, agenda, sala e configurazione."
        : "Prenotazioni, sala e configurazione sono limitate al ristorante assegnato al tuo account."}
    />
    <div className="mb-6 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-3">
      <IntroStat icon={Building2} value={String(accessibleLocations.length)} label={accessibleLocations.length === 1 ? "Ristorante autorizzato" : "Ristoranti operativi"} />
      <IntroStat icon={Network} value={String(totalReservations)} label="Prenotazioni attive" />
      <IntroStat icon={ShieldCheck} value={String(totalCovers)} label="Coperti previsti" />
    </div>
    <LocationCards summaries={summaries} activeLocationId={activeLocation.id} />
    {accessibleLocations.length > 1 && <CentralReservationsStream items={recentReservations} activeLocationId={activeLocation.id} />}
  </>;
}

function dayOfWeekInZone(timeZone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function IntroStat({ icon: Icon, value, label }: { icon: typeof Building2; value: string; label: string }) {
  return <div className="flex items-center gap-4 bg-card p-5"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span><div><p className="font-mono text-lg font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>;
}
