import { beforeEach, describe, expect, it } from "vitest";
import { GET as getKnowledge, PATCH as patchKnowledge, POST as postKnowledge } from "@/app/api/admin/v1/knowledge-base/route";
import { PATCH as patchSettings } from "@/app/api/admin/v1/settings/route";
import { getRestaurantSettings, updateRestaurantSettings } from "@/domains/settings/settings-service";
import { resetKnowledgeForTests } from "@/domains/knowledge/knowledge-service";

describe("admin configuration APIs", () => {
  beforeEach(() => resetKnowledgeForTests());

  it("creates and persists a verified knowledge item", async () => {
    const createResponse = await postKnowledge(new Request("http://localhost/api/admin/v1/knowledge-base", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({
        category: "Parcheggio",
        question: "Dove posso parcheggiare?",
        answer: "Il parcheggio va confermato dal ristorante prima della pubblicazione.",
        language: "it",
        isPublic: false,
        isActive: false,
        priority: 4,
      }),
    }));
    const created = await createResponse.json();
    expect(createResponse.status).toBe(201);
    expect(created.data.id).toMatch(/^[0-9a-f-]{36}$/);

    const patchResponse = await patchKnowledge(new Request("http://localhost/api/admin/v1/knowledge-base", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ ...created.data, isActive: true, isPublic: true }),
    }));
    expect(patchResponse.status).toBe(200);

    const list = await (await getKnowledge(new Request("http://localhost/api/admin/v1/knowledge-base"))).json();
    expect(list.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: created.data.id, isActive: true, isPublic: true }),
    ]));
  });

  it("rejects an invalid knowledge payload", async () => {
    const response = await postKnowledge(new Request("http://localhost/api/admin/v1/knowledge-base", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify({ category: "x" }),
    }));
    expect(response.status).toBe(422);
  });

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

  it("persists feature switches and voice AI policy together", async () => {
    const original = await getRestaurantSettings();
    const next = {
      ...original,
      features: { ...original.features, waitlistEnabled: false, customerCancellationEnabled: false },
      voiceAI: { ...original.voiceAI, assistantName: "Regia Test", allowCancellation: false, transferPartySize: 8 },
    };
    const response = await patchSettings(new Request("http://localhost/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", origin: "http://localhost" },
      body: JSON.stringify(next),
    }));
    expect(response.status).toBe(200);
    expect(await getRestaurantSettings()).toEqual(expect.objectContaining({
      features: expect.objectContaining({ waitlistEnabled: false, customerCancellationEnabled: false }),
      voiceAI: expect.objectContaining({ assistantName: "Regia Test", allowCancellation: false, transferPartySize: 8 }),
    }));
    await updateRestaurantSettings(original);
  });
});
