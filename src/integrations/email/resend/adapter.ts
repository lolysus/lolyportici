import "server-only";

import type { EmailAdapter, EmailMessage, EmailResult } from "@/integrations/email/types";

export class ResendEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<EmailResult> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) {
      console.info("[resend:sandbox]", { to: message.to, subject: message.subject });
      return { status: "sandbox" };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
    });
    if (!response.ok) throw new Error(`Resend error ${response.status}`);
    const data = await response.json() as { id: string };
    return { status: "sent", providerMessageId: data.id };
  }
}

