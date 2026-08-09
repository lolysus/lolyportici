import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listen = vi.fn();
const unlisten = vi.fn(async () => undefined);

vi.mock("@/lib/postgres", () => ({
  isPostgresConfigured: () => process.env.DATABASE_URL !== undefined,
  getPostgres: () => ({ listen }),
}));

const YUKO = "00000000-0000-0000-0000-000000000003";
const KOUSUSHI = "00000000-0000-0000-0000-000000000004";

function change(locationId: string, code: string) {
  return JSON.stringify({ op: "INSERT", id: `id-${code}`, locationId, code, status: "confirmed", date: "2026-08-20" });
}

async function hub() {
  vi.resetModules();
  return await import("@/lib/realtime/reservation-hub");
}

describe("distribuzione degli avvisi di prenotazione", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://finto";
    listen.mockReset();
    unlisten.mockClear();
    listen.mockImplementation(async () => ({ unlisten }));
    delete (globalThis as { __lolyReservationHub?: unknown }).__lolyReservationHub;
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete (globalThis as { __lolyReservationHub?: unknown }).__lolyReservationHub;
  });

  it("apre una sola connessione anche con molte dashboard collegate", async () => {
    const { subscribeToReservationChanges } = await hub();
    // Dieci tablet in due sale: dieci connessioni ferme in attesa sarebbero un
    // costo che cresce con le persone che lavorano.
    const stop = Array.from({ length: 10 }, () => subscribeToReservationChanges(YUKO, () => {}));
    expect(listen).toHaveBeenCalledTimes(1);
    for (const s of stop) s?.();
  });

  it("consegna l'avviso solo alla sede interessata", async () => {
    const { subscribeToReservationChanges } = await hub();
    const ardea: string[] = [];
    const portici: string[] = [];
    subscribeToReservationChanges(YUKO, (c) => ardea.push(c.code));
    subscribeToReservationChanges(KOUSUSHI, (c) => portici.push(c.code));

    const onNotify = listen.mock.calls[0][1] as (payload: string) => void;
    onNotify(change(YUKO, "YK-1"));
    onNotify(change(KOUSUSHI, "KS-1"));

    // È la garanzia che regge tutto l'isolamento delle notifiche: una
    // prenotazione di Portici non deve nemmeno sfiorare la dashboard di Ardea.
    expect(ardea).toEqual(["YK-1"]);
    expect(portici).toEqual(["KS-1"]);
  });

  it("smette di ascoltare quando l'ultima dashboard se ne va", async () => {
    const { subscribeToReservationChanges } = await hub();
    const primo = subscribeToReservationChanges(YUKO, () => {});
    const secondo = subscribeToReservationChanges(KOUSUSHI, () => {});
    primo?.();
    await Promise.resolve();
    expect(unlisten).not.toHaveBeenCalled();
    secondo?.();
    await new Promise((r) => setTimeout(r, 0));
    // Un backend senza nessuno collegato non deve tenere aperto niente.
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("un iscritto che va in errore non zittisce gli altri", async () => {
    const { subscribeToReservationChanges } = await hub();
    const arrivati: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    subscribeToReservationChanges(YUKO, () => { throw new Error("rotto"); });
    subscribeToReservationChanges(YUKO, (c) => arrivati.push(c.code));

    const onNotify = listen.mock.calls[0][1] as (payload: string) => void;
    onNotify(change(YUKO, "YK-2"));
    expect(arrivati).toEqual(["YK-2"]);
  });

  it("non cade su un messaggio illeggibile", async () => {
    const { subscribeToReservationChanges } = await hub();
    const arrivati: string[] = [];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    subscribeToReservationChanges(YUKO, (c) => arrivati.push(c.code));

    const onNotify = listen.mock.calls[0][1] as (payload: string) => void;
    onNotify("{non-json");
    onNotify(change(YUKO, "YK-3"));
    expect(arrivati).toEqual(["YK-3"]);
  });

  it("dice di no dove il database non c'è, invece di finire in ascolto del nulla", async () => {
    delete process.env.DATABASE_URL;
    const { subscribeToReservationChanges, reservationStreamAvailable } = await hub();
    // Chi chiama deve poter ripiegare sull'interrogazione: una dashboard
    // convinta di essere in diretta e ferma è il guasto peggiore.
    expect(reservationStreamAvailable()).toBe(false);
    expect(subscribeToReservationChanges(YUKO, () => {})).toBeNull();
    expect(listen).not.toHaveBeenCalled();
  });
});
