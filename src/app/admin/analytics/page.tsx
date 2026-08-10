import { PageHeading } from "@/components/admin/page-heading";
import { AnalyticsView } from "@/components/analytics/analytics-view";
import { computeAnalytics } from "@/domains/analytics/analytics-service";
import { requirePermission } from "@/lib/auth/dal";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { dateKeyInZone } from "@/lib/datetime";
import { getRepository } from "@/repositories";

export default async function AnalyticsPage() {
  await requirePermission("analytics:read");
  const location = await getActiveAdminLocation();
  // Le prenotazioni vere della sola sede: il repository è già vincolato a lei.
  const reservations = await getRepository(location.id).listReservations();
  // "Oggi" nel fuso del ristorante: a mezzanotte passata a Roma il periodo non
  // deve slittare di un giorno per via del fuso del server.
  const summary = computeAnalytics(reservations, { today: dateKeyInZone(new Date(), location.timezone) });

  return <>
    <PageHeading
      eyebrow={location.shortName}
      title="Analisi"
      description={`Andamento reale delle prenotazioni di ${location.city}, calcolato sui dati della sede.`}
    />
    <AnalyticsView key={location.id} location={location} summary={summary} />
  </>;
}
