import { describe, expect, it } from "vitest";
import { PATCH as patchSettings } from "@/app/api/admin/v1/settings/route";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";

describe("admin configuration API", () => {
  it("persists service capacity settings in demo mode", async () => {
    const original = await getRestaurantSettings();
    const response = await patchSettings(new Request("http://localhost/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ ...original, service: { ...original.service, maximumCovers: 74 } }),
    }));
    expect(response.status).toBe(200);
    expect((await getRestaurantSettings()).service.maximumCovers).toBe(74);
    await updateRestaurantSettings(original);
  });

  it("persists contact details and seating per restaurant", async () => {
    const original = await getRestaurantSettings();
    const next = {
      ...original,
      contact: {
        phone: "081 271258",
        whatsapp: "+39 329 9881193",
        whatsappMessage: "Ciao! Vorrei prenotare un tavolo da {ristorante}.",
        officialWebsite: "https://example.test",
        instagramUrl: "https://www.instagram.com/example",
        seatingIndoor: 70,
        seatingOutdoor: 0,
      },
    };
    const response = await patchSettings(new Request("http://localhost/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(next),
    }));
    expect(response.status).toBe(200);
    expect((await getRestaurantSettings()).contact).toEqual(next.contact);
    await updateRestaurantSettings(original);
  });

  it("rejects a contact payload with an empty required field", async () => {
    const original = await getRestaurantSettings();
    const response = await patchSettings(new Request("http://localhost/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ ...original, contact: { ...original.contact, officialWebsite: "not-a-url" } }),
    }));
    expect(response.status).toBe(422);
  });

  it("persists feature switches", async () => {
    const original = await getRestaurantSettings();
    const next = {
      ...original,
      features: { ...original.features, waitlistEnabled: false, customerCancellationEnabled: false },
    };
    const response = await patchSettings(new Request("http://localhost/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(next),
    }));
    expect(response.status).toBe(200);
    expect(await getRestaurantSettings()).toEqual(expect.objectContaining({
      features: expect.objectContaining({ waitlistEnabled: false, customerCancellationEnabled: false }),
    }));
    await updateRestaurantSettings(original);
  });
});
