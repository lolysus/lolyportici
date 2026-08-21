import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { ReservationsAgenda } from "@/components/reservations/reservations-agenda";
import { PrintReservationsMenu } from "@/components/reservations/print-reservations-button";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/dal";
import { dateKeyInZone } from "@/lib/datetime";
import { getRepository } from "@/repositories";
import { getActiveAdminLocation } from "@/lib/admin/location";

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ date?: string; reservation?: string }> }) {
  await requirePermission("reservations:read");
  const location = await getActiveAdminLocation();
  const repository = getRepository(location.id);
  const [{ date, reservation }, reservations, availabilityContext] = await Promise.all([
    searchParams,
    repository.listReservations(),
    repository.getAvailabilityContext(),
  ]);
  const selectedReservation = typeof reservation === "string" ? reservations.find((item) => item.id === reservation) : undefined;
  const initialDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : selectedReservation?.reservationDate ?? dateKeyInZone(new Date());

  return <>
    <PageHeading eyebrow={location.shortName} title="Agenda prenotazioni" description={`Calendario operativo di ${location.city}, collegato a servizi, capienza e canali reali.`} actions={<><PrintReservationsMenu reservations={reservations} tables={availabilityContext.tables} restaurantName={location.name} city={location.city} timezone={location.timezone} /><Button asChild><Link href={`/prenota/${location.slug}`}><CalendarPlus />Apri booking</Link></Button></>} />
    <ReservationsAgenda initialReservations={reservations} servicePeriods={availabilityContext.servicePeriods} closures={availabilityContext.closures} tables={availabilityContext.tables} initialDate={initialDate} initialSelectedId={selectedReservation?.id} restaurantName={location.name} city={location.city} timezone={location.timezone} />
  </>;
}
