import "server-only";

import type { EmailMessage } from "@/integrations/email/types";
import type { RestaurantLocation } from "@/config/brand";
import { emailSenderFor } from "@/config/email-sender";

/**
 * L'email che riporta dentro chi ha perso la password.
 *
 * Deve dire tre cose e basta: da quale ristorante arriva, entro quanto vale il
 * link, e cosa fare se non l'ha chiesto nessuno. Tutto il resto è rumore che
 * fa sembrare il messaggio una truffa — ed è esattamente il tipo di email che
 * i filtri e le persone cestinano.
 *
 * Il link non compare solo come pulsante: molti client di posta li disattivano
 * o li riscrivono, e a quel punto senza l'indirizzo per esteso l'utente resta
 * bloccato senza capire perché.
 */
export function buildPasswordResetEmail({ to, accountEmail, name, restaurant, resetUrl, minutes }: {
  to: string;
  /**
   * L'account a cui appartiene il link, quando il recapito è un altro indirizzo.
   *
   * Con una casella interna che raccoglie i link di tutte le sedi, senza questo
   * dato arriverebbero due messaggi quasi identici e nessuno saprebbe quale
   * password sta reimpostando.
   */
  accountEmail?: string;
  name: string;
  restaurant: RestaurantLocation;
  resetUrl: string;
  minutes: number;
}): EmailMessage {
  const perAltroAccount = Boolean(accountEmail && accountEmail.toLowerCase() !== to.toLowerCase());
  const subject = perAltroAccount
    ? `Reimposta la password · ${restaurant.shortName} · ${accountEmail}`
    : `Reimposta la password · ${restaurant.shortName}`;
  const greeting = name.trim() ? `Ciao ${name.trim().split(/\s+/)[0]},` : "Ciao,";
  const accent = restaurant.accentColor;

  const text = [
    greeting,
    "",
    `hai chiesto di reimpostare la password del pannello di ${restaurant.name} (${restaurant.city}).`,
    ...(perAltroAccount ? ["", `Account interessato: ${accountEmail}`] : []),
    "",
    `Apri questo indirizzo entro ${minutes} minuti:`,
    resetUrl,
    "",
    "Il link vale una volta sola. Se non hai chiesto tu il cambio, ignora questo messaggio: la password attuale resta valida e nessuno può usarla al posto tuo.",
    "",
    restaurant.name,
  ].join("\n");

  const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f4f2ee;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#191817">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2ded6">
    <tr><td style="height:4px;background:${accent}"></td></tr>
    <tr><td style="padding:32px 28px">
      <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a857c">${escapeHtml(restaurant.shortName)} · ${escapeHtml(restaurant.city)}</p>
      <h1 style="margin:12px 0 0;font-size:23px;line-height:1.25;font-weight:600">Reimposta la tua password</h1>
      <p style="margin:18px 0 0;font-size:15px;line-height:1.6">${escapeHtml(greeting)}</p>
      <p style="margin:10px 0 0;font-size:15px;line-height:1.6">hai chiesto di reimpostare la password del pannello di <strong>${escapeHtml(restaurant.name)}</strong>.</p>
      ${perAltroAccount ? `<p style="margin:14px 0 0;padding:12px 14px;background:#f6f4ef;border-left:4px solid ${accent};font-size:14px;line-height:1.5">Account interessato: <strong>${escapeHtml(accountEmail ?? "")}</strong></p>` : ""}
      <p style="margin:26px 0 0">
        <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:13px 24px;font-size:15px;font-weight:600">Scegli una nuova password</a>
      </p>
      <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#6f6a62">Il link vale <strong>${minutes} minuti</strong> e si può usare una volta sola.</p>
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#6f6a62">Se il pulsante non funziona, copia questo indirizzo nel browser:<br><span style="word-break:break-all;color:#191817">${escapeHtml(resetUrl)}</span></p>
      <hr style="margin:26px 0 0;border:none;border-top:1px solid #e8e4dc">
      <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6f6a62">Non hai chiesto tu il cambio? Ignora questo messaggio: la password attuale resta valida e questo link da solo non basta a entrare.</p>
    </td></tr>
  </table>
  <p style="margin:18px auto 0;max-width:520px;font-size:11px;line-height:1.6;color:#9c968c;text-align:center">${escapeHtml(restaurant.name)} · ${escapeHtml(restaurant.address)}</p>
</body></html>`;

  // Chi entra nel pannello di Portici deve vedere KouSushi come mittente: su
  // un'email che chiede di cambiare password, il mittente è la prima cosa che
  // si guarda per decidere se fidarsi.
  return { to, from: emailSenderFor(restaurant), subject, html, text };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] ?? character));
}
