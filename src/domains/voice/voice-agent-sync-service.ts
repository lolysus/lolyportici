import "server-only";

import { RetellAdapter } from "@/integrations/voice/retell/adapter";
import type { RestaurantSettings } from "@/types/settings";

export type VoiceAgentSync = {
  status: "configured" | "sandbox" | "pending";
};

const voiceTools = [
  "restaurant-information",
  "knowledge-answer",
  "check-availability",
  "create-hold",
  "confirm-reservation",
  "find-reservation",
  "modify-reservation",
  "add-reservation-note",
  "cancel-reservation",
  "waitlist",
  "request-callback",
  "send-booking-confirmation",
] as const;

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function buildPrompt(settings: RestaurantSettings) {
  const capabilities = [
    settings.voiceAI.allowNewReservations ? "creare prenotazioni" : null,
    settings.voiceAI.allowModifyReservations ? "modificare prenotazioni" : null,
    settings.voiceAI.allowCancellation ? "cancellare prenotazioni" : null,
    settings.voiceAI.allowWaitlist && settings.features.waitlistEnabled ? "gestire la lista d'attesa" : null,
  ].filter(Boolean).join(", ");

  return [
    `Sei ${settings.voiceAI.assistantName}, assistente telefonico del ristorante.`,
    `Lingua predefinita: ${settings.voiceAI.defaultLanguage}. Apertura: ${settings.voiceAI.greeting}`,
    `Puoi: ${capabilities || "fornire solo informazioni verificate"}.`,
    `Trasferisci al personale gruppi da ${settings.voiceAI.transferPartySize} ospiti in su${settings.voiceAI.transferOnAllergies ? " e ogni richiesta con allergie o intolleranze" : ""}.`,
    "Usa esclusivamente le risposte della knowledge base e i tool. Prima di modificare o cancellare identifica prenotazione e ospite. Se un'informazione non è verificata, crea una richiesta di richiamata; non inventare mai disponibilità, prezzi o policy.",
  ].join("\n");
}

export async function synchronizeVoiceAgent(settings: RestaurantSettings): Promise<VoiceAgentSync> {
  try {
    const result = await new RetellAdapter().createOrUpdateAgent(
      buildPrompt(settings),
      voiceTools.map((tool) => `${appUrl()}/api/voice/tools/${tool}`),
    );
    return { status: result.status };
  } catch (error) {
    console.error("[voice-agent:sync]", error);
    return { status: "pending" };
  }
}
