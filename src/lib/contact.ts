import { normalizePhone } from "@/domains/customers/normalization";

/** `tel:` valido solo se restano cifre: altrimenti il pulsante non deve comparire. */
export function buildPhoneHref(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized.replace(/\D/g, "").length >= 6 ? `tel:${normalized}` : "";
}

/**
 * wa.me richiede il numero senza "+" né spazi. Un numero italiano valido ha
 * 9 o 10 cifre dopo il prefisso 39: sotto quella soglia è quasi certamente un
 * numero incompleto, e un link WhatsApp morto è peggio di nessun link.
 *
 * Il controllo va fatto sulle cifre *dopo* il prefisso, non sul totale:
 * "+3933915436" ha 10 cifre in tutto ma solo 8 dopo il 39, ed è proprio il
 * numero incompleto che ha bloccato YUKO — un controllo sul totale lo avrebbe
 * lasciato passare.
 */
export function buildWhatsappHref(whatsapp: string, message: string, restaurantName: string) {
  const digits = normalizePhone(whatsapp).replace(/\D/g, "");
  const national = digits.startsWith("39") ? digits.slice(2) : digits;
  if (national.length < 9) return "";
  const text = message.trim().replace(/\{ristorante\}/gi, restaurantName);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
