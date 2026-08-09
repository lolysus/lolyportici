import { beforeEach, describe, expect, it } from "vitest";
import { restaurantLocations } from "@/config/brand";
import { listBookableTableOptions, tableAssignmentId } from "@/domains/availability/availability-service";
import { getRepository } from "@/repositories";
import { resetMemoryRepositoryForTests } from "@/repositories/memory-repository";
import { POST as postTables } from "@/app/api/public/v1/tables/route";
import { POST as postAvailability } from "@/app/api/public/v1/availability/route";
import { POST as postHold } from "@/app/api/public/v1/holds/route";

const [yuko, kousushi] = restaurantLocations;

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Il primo giorno con orari prenotabili, così il test non dipende da oggi. */
async function firstBookableSlot(locationId: string, partySize = 2) {
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const response = await postAvailability(jsonRequest("/api/public/v1/availability", { locationId, date, partySize, source: "web" }));
    const payload = await response.json() as { data?: { availableOptions: Array<{ startAt: string; endAt: string }> } };
    const option = payload.data?.availableOptions?.[0];
    if (option) return { date, option };
  }
  throw new Error("nessuno slot prenotabile nei prossimi 14 giorni");
}

describe("scelta del tavolo da parte del cliente", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("mostra soltanto tavoli che stanno nel gruppo", async () => {
    const partySize = 2;
    const { date, option } = await firstBookableSlot(yuko.id, partySize);
    const context = await getRepository(yuko.id).getAvailabilityContext();
    const options = listBookableTableOptions({ partySize }, context, option.startAt, option.endAt);

    expect(options.length).toBeGreaterThan(0);
    // Un tavolo mostrato e poi rifiutato alla conferma è peggio di un tavolo
    // non mostrato: la capienza va filtrata prima, non dopo.
    for (const bookable of options) expect(bookable.seats).toBeGreaterThanOrEqual(partySize);
    expect(options.filter((bookable) => bookable.recommended)).toHaveLength(1);
    expect(new Set(options.map((bookable) => bookable.id)).size).toBe(options.length);
    void date;
  });

  it("non espone posizioni in pianta né stato operativo dei tavoli", async () => {
    const { date, option } = await firstBookableSlot(yuko.id);
    const response = await postTables(jsonRequest("/api/public/v1/tables", { locationId: yuko.id, date, startAt: option.startAt, partySize: 2 }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { data: { tables: Array<Record<string, unknown>> } };
    expect(payload.data.tables.length).toBeGreaterThan(0);
    for (const bookable of payload.data.tables) {
      for (const leaked of ["positionX", "positionY", "status", "isStrategic", "diningAreaId"]) {
        expect(bookable).not.toHaveProperty(leaked);
      }
    }
  });

  it("prenota esattamente il tavolo scelto, non quello più comodo", async () => {
    const partySize = 2;
    const { date, option } = await firstBookableSlot(yuko.id, partySize);
    const context = await getRepository(yuko.id).getAvailabilityContext();
    const options = listBookableTableOptions({ partySize }, context, option.startAt, option.endAt);
    // Di proposito non il primo: il consigliato lo sceglierebbe il sistema
    // anche senza che il cliente dica niente, quindi non dimostrerebbe nulla.
    const wanted = options.at(-1)!;
    expect(wanted.recommended).toBe(false);

    const hold = await getRepository(yuko.id).createHold({
      availability: { locationId: yuko.id, date, partySize, source: "web" },
      startAt: option.startAt,
      sessionId: "test_session_scelta",
      tableSelectionId: wanted.id,
    });
    expect(tableAssignmentId({ ...hold, diningAreaName: "", score: 0, reason: "" })).toBe(wanted.id);
  });

  it("rifiuta il tavolo già impegnato invece di spostare il cliente altrove", async () => {
    const partySize = 2;
    const { date, option } = await firstBookableSlot(yuko.id, partySize);
    const repository = getRepository(yuko.id);
    const context = await repository.getAvailabilityContext();
    const wanted = listBookableTableOptions({ partySize }, context, option.startAt, option.endAt)[0];

    await repository.createHold({
      availability: { locationId: yuko.id, date, partySize, source: "web" },
      startAt: option.startAt, sessionId: "test_session_primo", tableSelectionId: wanted.id,
    });

    // Lo stesso tavolo, la stessa fascia, un altro cliente: deve fallire in
    // modo riconoscibile, non assegnare un tavolo diverso senza dirlo.
    await expect(repository.createHold({
      availability: { locationId: yuko.id, date, partySize, source: "web" },
      startAt: option.startAt, sessionId: "test_session_secondo", tableSelectionId: wanted.id,
    })).rejects.toMatchObject({ code: "TABLE_NO_LONGER_AVAILABLE" });
  });

  it("porta le alternative dentro l'errore, per non far ricominciare dall'orario", async () => {
    const partySize = 2;
    const { date, option } = await firstBookableSlot(yuko.id, partySize);
    const repository = getRepository(yuko.id);
    const context = await repository.getAvailabilityContext();
    const wanted = listBookableTableOptions({ partySize }, context, option.startAt, option.endAt)[0];
    await repository.createHold({
      availability: { locationId: yuko.id, date, partySize, source: "web" },
      startAt: option.startAt, sessionId: "test_session_a", tableSelectionId: wanted.id,
    });

    const response = await postHold(jsonRequest("/api/public/v1/holds", {
      locationId: yuko.id, date, partySize, source: "web",
      startAt: option.startAt, sessionId: "test_session_b", tableSelectionId: wanted.id,
    }));
    expect(response.status).toBe(409);
    const payload = await response.json() as { error: { code: string; details: { tables: Array<{ id: string }> } } };
    expect(payload.error.code).toBe("TABLE_NO_LONGER_AVAILABLE");
    expect(payload.error.details.tables.every((bookable) => bookable.id !== wanted.id)).toBe(true);
  });

  it("rifiuta un tavolo che in questa sede non esiste, invece di assegnarne uno a caso", async () => {
    const partySize = 2;
    const { date, option } = await firstBookableSlot(kousushi.id, partySize);

    // È la garanzia che riguarda la sicurezza: l'identificativo arriva dal
    // client, e un identificativo che non compare fra i tavoli **di questa
    // sede** non deve ricadere sull'assegnazione automatica. Se ricadesse, il
    // vincolo scelto dal cliente sarebbe solo un suggerimento e un id inventato
    // produrrebbe comunque una prenotazione.
    await expect(getRepository(kousushi.id).createHold({
      availability: { locationId: kousushi.id, date, partySize, source: "web" },
      startAt: option.startAt,
      sessionId: "test_session_inesistente",
      tableSelectionId: "20000000-0000-0000-0000-0000000000ff",
    })).rejects.toMatchObject({ code: "TABLE_NO_LONGER_AVAILABLE" });
  });

  /**
   * Nota su cosa questo file NON può dimostrare: in memoria le due sedi sono
   * seminate dalla stessa copia dei tavoli demo, quindi gli identificativi
   * coincidono e "il tavolo di Ardea a Portici" è indistinguibile da un tavolo
   * legittimo. Su Postgres i tavoli sono righe per sede con UUID distinti e il
   * contesto di disponibilità carica solo quelli della propria sede.
   * L'isolamento dei dati fra le due sedi è coperto da `multi-location.test.ts`.
   */
});
