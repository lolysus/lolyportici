import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { DashboardView } from "@/components/admin/dashboard-view";
import { PageHeading } from "@/components/admin/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { reconcileReservationLifecycle } from "@/domains/bookings/reservation-lifecycle-service";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";
import { getRepository } from "@/repositories";

export default async function DashboardPage() {
  await requirePermission("reservations:read");
  const location = await getActiveAdminLocation();
  await reconcileReservationLifecycle(location.id);
  const repository = getRepository(location.id);
  const [reservations, waitlist, settings] = await Promise.all([
    repository.listReservations(),
    repository.listWaitlist(),
    getRestaurantSettings(location.id),
  ]);
  const today = new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long", timeZone: location.timezone }).format(new Date());
  // Saluto e servizio venivano scritti a mano come "Buonasera" e "Servizio
  // cena": a mezzogiorno il pannello dava del buonasera a chi apriva il pranzo.
  const hour = Number(new Intl.DateTimeFormat("it", { hour: "2-digit", hour12: false, timeZone: location.timezone }).format(new Date()));
  const greeting = hour < 12 ? "Buongiorno" : hour < 17 ? "Buon pomeriggio" : "Buonasera";
  const serviceLabel = hour < 17 ? "Servizio pranzo" : "Servizio cena";
  const modeDescription = settings.operations.serviceMode === "live"
    ? "Tutti i canali attivi sono sincronizzati."
    : settings.operations.serviceMode === "approval"
      ? "Le nuove richieste richiedono la verifica dello staff."
      : "Le nuove richieste sono temporaneamente sospese.";

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title={`${greeting}, ${today}`}
      description={`Il servizio di ${location.city} è in preparazione. ${modeDescription}`}
      actions={<><Badge variant="outline" className="h-9 px-3">{serviceLabel}</Badge><Button asChild><Link href={`/it/book/${location.slug}`}><CalendarPlus />Nuova prenotazione</Link></Button></>}
    />
    <DashboardView reservations={reservations} waitlist={waitlist} location={location} settings={settings} />
  </>;
}
