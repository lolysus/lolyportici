import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DELETE as cancelReservation } from "@/app/api/public/v1/reservations/manage/[token]/route";
import { restaurantConfig } from "@/config/brand";
import { checkAvailability } from "@/domains/availability/availability-service";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";
import { dateKeyInZone } from "@/lib/datetime";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";
import type { RestaurantSettings } from "@/types/settings";

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

describe("customer booking policy", () => {
  let originalSettings: RestaurantSettings;

  beforeEach(async () => {
    resetMemoryRepositoryForTests();
    originalSettings = await getRestaurantSettings();
  });

  afterEach(async () => {
    await updateRestaurantSettings(originalSettings);
  });

  it("enforces the configured online cancellation deadline", async () => {
    await updateRestaurantSettings({
      ...originalSettings,
      policies: { ...originalSettings.policies, cancellationDeadlineHours: 168 },
    });
    const repository = getRepository();
    const availability = {
      locationId: restaurantConfig.locationId,
      date,
      requestedTime: "19:00",
      partySize: 2,
      source: "web" as const,
    };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    expect(option).toBeDefined();
    const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: "customer-policy-session" });
    const confirmed = await repository.confirmHold({
      holdId: hold.id,
      idempotencyKey: "customer-policy-idempotency-key",
      customer: {
        firstName: "Giada",
        lastName: "Policy",
        phone: "+393331234510",
        privacyConsent: true,
        preferredLanguage: "it",
        marketingConsent: false,
      },
    });

    const response = await cancelReservation(new Request(`http://localhost/api/public/v1/reservations/manage/${confirmed.managementToken}`, {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-forwarded-for": "customer-policy-deadline" },
      body: JSON.stringify({ reason: "Cambio programma" }),
    }), { params: Promise.resolve({ token: confirmed.managementToken }) } as never);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("CANCELLATION_DEADLINE_PASSED");
  });
});
