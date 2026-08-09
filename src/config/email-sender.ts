import type { RestaurantLocation } from "@/config/brand";

/**
 * Il mittente delle email, scelto in base al ristorante.
 *
 * YUKO e KouSushi sono due attività separate con due domini separati. Una
 * conferma di prenotazione a Portici che arriva da un indirizzo `@yukoardea.it`
 * non sembra un dettaglio sbagliato: sembra un raggiro. Il cliente non la apre,
 * e i filtri antispam la trattano di conseguenza.
 *
 *   EMAIL_FROM_BY_LOCATION="yuko=noreply@yukoardea.it,kousushi=noreply@kousushiportici.it"
 *
 * `EMAIL_FROM` resta la rete di sicurezza per una sede non elencata: spedire
 * dal mittente sbagliato è comunque meglio che non spedire.
 *
 * Attenzione: il dominio del mittente deve essere **verificato su Resend**
 * (resend.com/domains, record SPF e DKIM nel DNS). Se non lo è, Resend rifiuta
 * l'invio con 403 e il destinatario non riceve niente — senza che l'app possa
 * accorgersene prima di provare.
 */
export function emailSenderFor(restaurant: Pick<RestaurantLocation, "slug" | "shortName">) {
  const address = configuredSenders().get(restaurant.slug) ?? process.env.EMAIL_FROM?.trim();
  if (!address) return undefined;
  // Se il valore contiene già un nome fra parentesi angolari è stato scritto
  // per intero a mano: rispettiamolo invece di annidarlo dentro un altro.
  if (address.includes("<")) return address;
  // Il nome davanti all'indirizzo è ciò che si legge nella lista dei messaggi:
  // "KouSushi" si riconosce a colpo d'occhio, "noreply@" no.
  const label = restaurant.shortName.replace(/[<>",;:@\\]/g, "").trim();
  return label ? `${label} <${address}>` : address;
}

/**
 * Le conferme di prenotazione al cliente vanno accese di proposito.
 *
 * La chiave Resend è una sola per tutta l'app, quindi configurarla per il
 * recupero password dello staff accendeva di rimbalzo anche le email ai
 * clienti — un cambiamento verso l'esterno che nessuno aveva chiesto.
 * `notifications.emailConfirmationEnabled` è una preferenza del ristoratore,
 * salvata fra le impostazioni della sede e attiva per default: non è il posto
 * dove esprimere "Resend serve solo al recupero password", che è una decisione
 * di chi gestisce la piattaforma, non del ristorante.
 *
 * Perciò questo interruttore è un consenso esplicito e non un default:
 *
 *   GUEST_CONFIRMATION_EMAIL=on
 *
 * Spento, la prenotazione funziona esattamente come prima e `/api/health` lo
 * dichiara — non deve sembrare un guasto.
 */
export function guestConfirmationEmailEnabled() {
  const value = process.env.GUEST_CONFIRMATION_EMAIL?.trim().toLowerCase();
  return value === "on" || value === "true" || value === "1";
}

/** Vero se esiste un mittente spendibile per questa sede. */
export function emailSenderConfigured(restaurant: Pick<RestaurantLocation, "slug" | "shortName">) {
  return Boolean(emailSenderFor(restaurant));
}

function configuredSenders(): ReadonlyMap<string, string> {
  const senders = new Map<string, string>();
  const raw = process.env.EMAIL_FROM_BY_LOCATION?.trim();
  if (!raw) return senders;
  for (const entry of raw.split(",")) {
    const separator = entry.indexOf("=");
    if (separator < 1) continue;
    const slug = entry.slice(0, separator).trim().toLowerCase();
    const address = entry.slice(separator + 1).trim();
    if (slug && address) senders.set(slug, address);
  }
  return senders;
}
