import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { POST as postAvailability } from "@/app/api/public/v1/availability/route";
import { POST as postHold } from "@/app/api/public/v1/holds/route";
import { restaurantConfig } from "@/config/brand";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";
import { dateKeyInZone, localDateTimeToUtc } from "@/lib/datetime";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";
import type { RestaurantSettings } from "@/types/settings";

const foreignLocationId = "11111111-1111-1111-1111-111111111111";
const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const validDate = tomorrow.toISOString().slice(0, 10);

function request(path: string, body: unknown, requestId: string) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": requestId },
    body: JSON.stringify(body),
  });
}

describe("public channel boundaries", () => {
  let originalSettings: RestaurantSettings;

  beforeEach(async () => {
    resetMemoryRepositoryForTests();
    originalSettings = await getRestaurantSettings();
  });

  afterEach(async () => {
    await updateRestaurantSettings(originalSettings);
  });

  it("forces availability requests onto the public web channel", async () => {
    await updateRestaurantSettings({
      ...originalSettings,
      service: { ...originalSettings.service, onlineBookingEnabled: false, phoneBookingEnabled: true },
    });

    const response = await postAvailability(request("/api/public/v1/availability", {
      locationId: foreignLocationId,
      date: validDate,
      requestedTime: "19:00",
      partySize: 2,
      source: "phone_ai",
    }, "public-availability-channel-boundary"));

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.availableOptions).toHaveLength(0);
  });

  it("does not allow a public hold to borrow the phone AI channel", async () => {
    await updateRestaurantSettings({
      ...originalSettings,
      service: { ...originalSettings.service, onlineBookingEnabled: false, phoneBookingEnabled: true },
    });

    const response = await postHold(request("/api/public/v1/holds", {
      locationId: foreignLocationId,
      date: validDate,
      partySize: 2,
      source: "phone_ai",
      startAt: localDateTimeToUtc(validDate, "19:00").toISOString(),
      sessionId: "public-channel-boundary-session",
    }, "public-hold-channel-boundary"));

    expect(response.status).toBe(409);
  });

  it("pins public holds to the configured restaurant location", async () => {
    const availabilityResponse = await postAvailability(request("/api/public/v1/availability", {
      locationId: restaurantConfig.locationId,
      date: validDate,
      partySize: 2,
      source: "web",
    }, "public-hold-location-availability"));
    const availability = await availabilityResponse.json();
    const startAt = availability.data.availableOptions[0].startAt as string;

    const response = await postHold(request("/api/public/v1/holds", {
      locationId: foreignLocationId,
      date: validDate,
      partySize: 2,
      source: "phone_ai",
      startAt,
      sessionId: "public-location-boundary-session",
    }, "public-hold-location-boundary"));

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.locationId).toBe(restaurantConfig.locationId);
  });
});
