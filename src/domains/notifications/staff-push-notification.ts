import "server-only";

import type { RestaurantLocation } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import { sendPushToLocation } from "@/lib/push/web-push-service";
import type { PublicReservation } from "@/repositories/repository";

/**
 * Avvisa il personale di una nuova prenotazione, sui telefoni che hanno
 * installato l'app e acceso le notifiche.
 *
 * Va chiamata "fire and forget": se la push non parte, la prenotazione resta
 * valida lo stesso. Il contenuto è quel che serve a chi è in sala — nome,
 * coperti, ora — e al tocco porta dritto alla scheda in agenda.
 */
export async function notifyStaffOfReservation(location: RestaurantLocation, reservation: PublicReservation) {
  const time = formatTimeInZone(reservation.startAt, location.timezone);
  const guest = reservation.customer.firstName.trim() || "Ospite";
  await sendPushToLocation(location.id, {
    title: `Nuova prenotazione · ${location.shortName}`,
    body: `${guest} · ${reservation.partySize} ${reservation.partySize === 1 ? "persona" : "persone"} · ${time}`,
    url: `/admin/${location.slug}/reservations?date=${reservation.reservationDate}&reservation=${reservation.id}`,
    tag: `reservation-${reservation.id}`,
    icon: `/brands/${location.slug}-icon-192.png`,
  });
}
