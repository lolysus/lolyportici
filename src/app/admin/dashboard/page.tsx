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
  const [reservations, waitlist, calls, settings] = await Promise.all([
    repository.listReservations(),
    repository.listWaitlist(),
    repository.listCalls(),
    getRestaurantSettings(location.id),
  ]);
  const today = new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const modeDescription = settings.operations.serviceMode === "live"
    ? "Tutti i canali attivi sono sincronizzati."
    : settings.operations.serviceMode === "approval"
      ? "Le nuove richieste richiedono la verifica dello staff."
      : "Le nuove richieste sono temporaneamente sospese.";

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title={`Buonasera, ${today}`}
      description={`Il servizio di ${location.city} è in preparazione. ${modeDescription}`}
      actions={<><Badge variant="outline" className="h-9 px-3">Servizio cena</Badge><Button asChild><Link href={`/it/book/${location.slug}`}><CalendarPlus />Nuova prenotazione</Link></Button></>}
    />
    <DashboardView reservations={reservations} waitlist={waitlist} calls={calls} location={location} settings={settings} />
  </>;
}
