import "server-only";

export class WhatsAppAdapter {
  async send(to: string, template: string, parameters: string[]) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) { console.info("[whatsapp:sandbox]", { to, template }); return { status: "sandbox" as const }; }
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: "it" }, components: [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }] } }) });
    if (!response.ok) throw new Error(`WhatsApp error ${response.status}`);
    return { status: "sent" as const };
  }
}

