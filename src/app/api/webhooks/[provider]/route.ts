import { after } from "next/server";
import { DomainError, WebhookVerificationError } from "@/domains/bookings/errors";
import { failure, success } from "@/lib/api/response";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyResendSignature, verifyTelnyxSignature } from "@/lib/security";

const globalEvents = globalThis as typeof globalThis & { __webhookEvents?: Set<string> };
const processedEvents = globalEvents.__webhookEvents ??= new Set<string>();

function hasValidSignature(provider: string, request: Request, rawBody: string) {
  if (provider === "telnyx") {
    return verifyTelnyxSignature(
      rawBody,
      request.headers.get("telnyx-signature-ed25519"),
      request.headers.get("telnyx-timestamp"),
    );
  }
  if (provider === "resend") {
    return verifyResendSignature(rawBody, {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    });
  }
  return false;
}

async function processEvent(provider: string, payload: Record<string, unknown>, eventId: string) {
  console.info("[webhook:processed]", { provider, eventId, type: payload.type });
}

async function claimEvent(
  provider: string,
  eventId: string,
  payload: Record<string, unknown>,
) {
  if (!isSupabaseConfigured()) {
    const key = `${provider}:${eventId}`;
    if (processedEvents.has(key)) return false;
    processedEvents.add(key);
    return true;
  }
  const { error } = await getSupabaseAdmin().from("webhook_events").insert({
    provider,
    provider_event_id: eventId,
    event_type: String(payload.event ?? payload.type ?? "unknown"),
    payload,
    status: "received",
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function markProcessed(provider: string, eventId: string, error?: unknown) {
  if (!isSupabaseConfigured()) return;
  await getSupabaseAdmin()
    .from("webhook_events")
    .update({
      status: error ? "failed" : "processed",
      error_message: error instanceof Error ? error.message : error ? "Unknown processing error" : null,
      processed_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("provider_event_id", eventId);
}

export async function POST(request: Request, context: RouteContext<"/api/webhooks/[provider]">) {
  try {
    const { provider } = await context.params;
    if (!new Set(["telnyx", "resend"]).has(provider)) throw new DomainError("WEBHOOK_PROVIDER_NOT_FOUND", "Provider non riconosciuto.", 404);
    const rawBody = await request.text();
    if (!hasValidSignature(provider, request, rawBody)) throw new WebhookVerificationError();
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const eventId = String(
      payload.id ?? payload.event_id ?? data.id ?? request.headers.get("svix-id") ?? "",
    );
    if (!eventId) throw new DomainError("MISSING_EVENT_ID", "Identificativo evento mancante.", 422);
    if (!(await claimEvent(provider, eventId, payload))) return success({ received: true, duplicate: true });
    after(async () => {
      try {
        await processEvent(provider, payload, eventId);
        await markProcessed(provider, eventId);
      } catch (processingError) {
        console.error("[webhook:failed]", { provider, eventId, processingError });
        await markProcessed(provider, eventId, processingError);
      }
    });
    return success({ received: true }, { status: 202 });
  } catch (error) { return failure(error); }
}
