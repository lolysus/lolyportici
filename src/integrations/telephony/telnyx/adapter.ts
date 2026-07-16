import "server-only";

import type { SmsMessage, SmsResult, TelephonyAdapter } from "@/integrations/telephony/types";

export class TelnyxAdapter implements TelephonyAdapter {
  async sendSms(message: SmsMessage): Promise<SmsResult> {
    const apiKey = process.env.TELNYX_API_KEY;
    const from = process.env.TELNYX_FROM_NUMBER;
    if (!apiKey || !from) { console.info("[telnyx:sandbox]", { to: message.to, text: message.text }); return { status: "sandbox" }; }
    const response = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: message.to, text: message.text, messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID }),
    });
    if (!response.ok) throw new Error(`Telnyx error ${response.status}`);
    const data = await response.json() as { data?: { id?: string } };
    return { status: "sent", providerMessageId: data.data?.id };
  }
}

