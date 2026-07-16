import { beforeEach, describe, expect, it } from "vitest";
import { POST as postVoiceTool } from "@/app/api/voice/tools/[tool]/route";
import { checkAvailability } from "@/domains/availability/availability-service";
import { HoldExpiredError } from "@/domains/bookings/errors";
import { restaurantConfig, restaurantLocations } from "@/config/brand";
import { dateKeyInZone } from "@/lib/datetime";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

function invokeVoiceTool(tool: string, body: unknown) {
  return postVoiceTool(new Request(`http://localhost/api/voice/tools/${tool}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `voice-escalation-${tool}` },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ tool }) } as never);
}

describe("voice escalation tools", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("persists a callback request for the staff", async () => {
    const response = await invokeVoiceTool("request-callback", {
      callerPhone: "+393331234567",
      reason: "Richiesta per una festa privata",
      callId: "retell-callback-test",
    });
    const body = await response.json() as { data?: { callbackRequestId: string; status: string } };

    expect(response.status).toBe(202);
    expect(body.data?.status).toBe("queued");
    const call = (await getRepository().listCalls()).find((item) => item.id === body.data?.callbackRequestId);
    expect(call).toMatchObject({
      provider: "retell",
      providerCallId: "escalation:retell-callback-test",
      callerPhone: "+393331234567",
      status: "callback_requested",
      humanEscalationRequired: true,
    });
  });

  it("routes voice activity to the requested location", async () => {
    const mare = restaurantLocations[1];
    const response = await invokeVoiceTool("request-callback", {
      locationId: mare.id,
      callerPhone: "+393331234570",
      reason: "Richiesta tavolo vista mare",
      callId: "retell-mare-callback-test",
    });
    const body = await response.json() as { data?: { callbackRequestId: string } };

    expect(response.status).toBe(202);
    expect((await getRepository(mare.id).listCalls()).some((call) => call.id === body.data?.callbackRequestId)).toBe(true);
    expect((await getRepository(restaurantLocations[0].id).listCalls()).some((call) => call.id === body.data?.callbackRequestId)).toBe(false);
  });

  it("creates a visible escalation for large telephone groups", async () => {
    const response = await invokeVoiceTool("check-availability", {
      locationId: restaurantConfig.locationId,
      date,
      partySize: 10,
      callerPhone: "+393331234568",
      callId: "retell-large-party-test",
    });
    const body = await response.json() as { data?: { transferRequired: boolean; escalationId: string } };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ transferRequired: true });
    const call = (await getRepository().listCalls()).find((item) => item.id === body.data?.escalationId);
    expect(call).toMatchObject({
      providerCallId: "escalation:retell-large-party-test",
      status: "callback_requested",
      humanEscalationRequired: true,
    });
  });

  it("releases the hold and records an escalation for allergies", async () => {
    const repository = getRepository();
    const availability = {
      locationId: restaurantConfig.locationId,
      date,
      requestedTime: "19:00",
      partySize: 2,
      source: "phone_ai" as const,
    };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    expect(option).toBeDefined();
    const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: "voice-allergy-test-session" });

    const response = await invokeVoiceTool("confirm-reservation", {
      holdId: hold.id,
      idempotencyKey: "voice-allergy-test-idempotency-key",
      customer: {
        firstName: "Luca",
        lastName: "Allergia",
        phone: "+393331234569",
        privacyConsent: true,
        allergies: "Arachidi",
      },
      callId: "retell-allergy-test",
    });
    const body = await response.json() as { data?: { escalationId: string; holdReleased: boolean; status: string } };

    expect(response.status).toBe(202);
    expect(body.data).toMatchObject({ status: "transfer_required", holdReleased: true });
    const call = (await repository.listCalls()).find((item) => item.id === body.data?.escalationId);
    expect(call).toMatchObject({
      providerCallId: "escalation:retell-allergy-test",
      callerPhone: "+393331234569",
      status: "callback_requested",
      humanEscalationRequired: true,
    });
    await expect(repository.confirmHold({
      holdId: hold.id,
      idempotencyKey: "voice-allergy-retry-idempotency-key",
      customer: { firstName: "Luca", lastName: "Allergia", phone: "+393331234569", privacyConsent: true, preferredLanguage: "it", marketingConsent: false },
    })).rejects.toBeInstanceOf(HoldExpiredError);
  });
});
