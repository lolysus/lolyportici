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
  const guest = `${reservation.customer.firstName} ${reservation.customer.lastName}`.trim() || "Ospite";
  const people = `${reservation.partySize} ${reservation.partySize === 1 ? "persona" : "persone"}`;
  // La data compare solo se non è oggi: per il servizio corrente basta l'ora, e
  // un "oggi" ripetuto su ogni notifica è rumore.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: location.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dayPrefix = reservation.reservationDate === today ? "" : `${formatDayLabel(reservation.reservationDate)} · `;
  // L'allergia va vista prima ancora di aprire: è ciò che cambia la cucina.
  const allergyFlag = reservation.customer.allergies?.trim() ? " · ⚠ allergie" : "";
  await sendPushToLocation(location.id, {
    title: `Nuova prenotazione · ${location.shortName}`,
    body: `${guest} · ${people} · ${dayPrefix}${time}${allergyFlag}`,
    url: `/admin/${location.slug}/reservations?date=${reservation.reservationDate}&reservation=${reservation.id}`,
    tag: `reservation-${reservation.id}`,
    icon: `/brands/${location.slug}-icon-192.png`,
    timestamp: Date.parse(reservation.createdAt) || Date.now(),
  });
}

function formatDayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateKey : new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date);
}
