import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/public/v1/availability/route";
import { restaurantConfig } from "@/config/brand";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";
import { dateKeyInZone, formatTimeInZone } from "@/lib/datetime";

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const validDate = tomorrow.toISOString().slice(0, 10);

describe("POST /api/public/v1/availability", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("returns typed availability data", async () => {
    const response = await POST(new Request("http://localhost/api/public/v1/availability", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "route-test-success" },
      body: JSON.stringify({
        locationId: restaurantConfig.locationId,
        date: validDate,
        requestedTime: "19:00",
        partySize: 2,
        source: "web",
      }),
    }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(formatTimeInZone(body.data.availableOptions[0].startAt)).toBe("19:00");
    expect(body.data.availableOptions[0]).not.toHaveProperty("tableIds");
    expect(body.data.availableOptions[0]).not.toHaveProperty("diningArea");
  });

  it("returns a stable validation error envelope", async () => {
    const response = await POST(new Request("http://localhost/api/public/v1/availability", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "route-test-invalid" },
      body: JSON.stringify({ locationId: "invalid", date: "tomorrow", partySize: 0 }),
    }));
    const body = await response.json();
    expect(response.status).toBe(422);
    expect(body).toMatchObject({ success: false, error: { code: "VALIDATION_ERROR" } });
  });
});
