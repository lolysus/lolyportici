import { beforeEach, describe, expect, it } from "vitest";
import { POST as checkAvailability } from "@/app/api/public/v1/availability/route";
import { restaurantConfig, restaurantLocations } from "@/config/brand";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

const today = new Date();
const target = new Date(today);
target.setUTCDate(target.getUTCDate() + 1);
const closedDate = target.toISOString().slice(0, 10);

/**
 * Senza `requestedTime` l'API restituisce l'elenco completo: con un orario
 * richiesto tornerebbe solo quello, e non si vedrebbe cosa resta aperto.
 */
async function options(date: string, ip: string) {
  const response = await checkAvailability(new Request("http://localhost/api/public/v1/availability", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ locationId: restaurantConfig.locationId, date, partySize: 2, source: "web" }),
  }));
  const body = await response.json() as { data?: { availableOptions?: Array<{ startAt: string }> } };
  return body.data?.availableOptions ?? [];
}

function localTime(startAt: string) {
  return new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(startAt));
}

describe("chiusure straordinarie", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("una chiusura di giornata toglie tutti gli orari", async () => {
    const before = await options(closedDate, "closure-day-before");
    expect(before.length).toBeGreaterThan(0);

    await getRepository(restaurantConfig.locationId).createClosure({
      date: closedDate, type: "full_closure", reason: "Ferie",
    });

    expect(await options(closedDate, "closure-day-after")).toHaveLength(0);
  });

  it("una chiusura a fascia toglie solo quella fascia", async () => {
    await getRepository(restaurantConfig.locationId).createClosure({
      date: closedDate, startTime: "19:00", endTime: "21:00", type: "private_event", reason: "Evento privato",
    });

    const remaining = await options(closedDate, "closure-partial");
    // Restano orari, ma nessuno dentro la fascia chiusa.
    expect(remaining.length).toBeGreaterThan(0);
    expect(remaining.filter((option) => localTime(option.startAt) >= "19:00" && localTime(option.startAt) < "21:00")).toHaveLength(0);
    expect(remaining.some((option) => localTime(option.startAt) >= "21:00")).toBe(true);
  });

  it("la chiusura di una sede non tocca l'altra", async () => {
    const [yuko, kousushi] = restaurantLocations;
    await getRepository(yuko.id).createClosure({ date: closedDate, type: "full_closure", reason: "Ferie Ardea" });

    expect(await getRepository(yuko.id).listClosures()).toHaveLength(1);
    // Il giorno chiuso ad Ardea non deve comparire fra le chiusure di Portici:
    // è l'errore che renderebbe inutile tutta la separazione fra i due locali.
    expect(await getRepository(kousushi.id).listClosures()).toHaveLength(0);
  });

  it("una chiusura eliminata smette di bloccare", async () => {
    const repository = getRepository(restaurantConfig.locationId);
    const closure = await repository.createClosure({ date: closedDate, type: "full_closure", reason: "Annullata" });
    expect(await options(closedDate, "closure-removed-blocked")).toHaveLength(0);

    await repository.deleteClosure(closure.id);
    expect((await options(closedDate, "closure-removed-free")).length).toBeGreaterThan(0);
  });
});
