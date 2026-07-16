import { brandConfig, getRestaurantLocationById, restaurantConfig } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import type { PublicReservation } from "@/repositories/repository";

const copy = {
  it: { subject: "Prenotazione confermata", hello: "La tua prenotazione è confermata", guests: "persone" },
  en: { subject: "Reservation confirmed", hello: "Your reservation is confirmed", guests: "guests" },
  es: { subject: "Reserva confirmada", hello: "Tu reserva está confirmada", guests: "personas" },
} as const;

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] ?? character);
}

export function reservationConfirmationEmail(reservation: PublicReservation) {
  const language = reservation.language === "en" || reservation.language === "es" ? reservation.language : "it";
  const text = copy[language];
  const location = getRestaurantLocationById(reservation.locationId);
  const restaurant = location ?? restaurantConfig;
  const date = new Intl.DateTimeFormat(language, { dateStyle: "full", timeZone: restaurant.timezone }).format(new Date(reservation.startAt));
  const time = formatTimeInZone(reservation.startAt);
  const plain = `${text.hello}. ${date}, ${time}, ${reservation.partySize} ${text.guests}. Codice: ${reservation.reservationCode}.`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f0e7;color:#171a16;font-family:Arial,sans-serif"><div style="max-width:600px;margin:auto;padding:40px 24px"><img src="${appUrl}${location?.logoPath ?? brandConfig.logoPath}" alt="${escapeHtml(restaurant.name)}" width="220" style="display:block;background:#111;padding:16px"><h1 style="font-size:28px">${escapeHtml(text.hello)}</h1><p>${escapeHtml(date)} · ${escapeHtml(time)} · ${escapeHtml(reservation.partySize)} ${escapeHtml(text.guests)}</p><p style="font-size:20px"><strong>${escapeHtml(reservation.reservationCode)}</strong></p><p>${escapeHtml(restaurant.address)}</p></div></body></html>`;
  return { subject: `${text.subject} · ${reservation.reservationCode}`, html, text: plain };
}
