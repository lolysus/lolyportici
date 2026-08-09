import "server-only";

import type { EmailAdapter, EmailMessage, EmailResult } from "@/integrations/email/types";

export class ResendEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<EmailResult> {
    const key = process.env.RESEND_API_KEY;
    // Il mittente arriva da chi compone il messaggio, che sa da quale
    // ristorante parte; `EMAIL_FROM` copre chi non lo specifica.
    const from = message.from ?? process.env.EMAIL_FROM;
    if (!key || !from) {
      console.info("[resend:sandbox]", { to: message.to, subject: message.subject });
      return { status: "sandbox" };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) {
      // Il motivo va nel messaggio, non solo il codice: il rifiuto più comune è
      // "dominio non verificato", e senza il testo di Resend nei log si perde
      // mezz'ora a cercare un guasto nell'app che non c'è.
      const reason = await response.text().catch(() => "");
      throw new Error(`Resend error ${response.status} (from: ${from})${reason ? ` — ${reason}` : ""}`);
    }
    const data = await response.json() as { id: string };
    return { status: "sent", providerMessageId: data.id };
  }
}

