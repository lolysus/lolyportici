import { beforeEach, describe, expect, it } from "vitest";
import { checkAvailability } from "@/domains/availability/availability-service";
import { SlotUnavailableError } from "@/domains/bookings/errors";
import { restaurantLocations } from "@/config/brand";
import { dateKeyInZone } from "@/lib/datetime";
import { MemoryReservationRepository, resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

const [ardea, portici] = restaurantLocations;

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

function customerFor(name: string) {
  return {
    firstName: name, lastName: "Test", phone: "+39 333 000 0000",
    preferredLanguage: "it" as const, marketingConsent: false, privacyConsent: true,
  };
}

describe("limiti per fascia oraria", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("restringe gli arrivi oltre quanto già fanno i tavoli", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    // La cena di default consente fino a 8 arrivi alle 19:00 (demo settings):
    // una fascia più stretta deve vincere, anche se i tavoli ci sarebbero.
    await repository.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 1 });

    const availability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    expect(option).toBeDefined();

    const first = await repository.createHold({ availability, startAt: option.startAt, sessionId: "session-band-1" });
    await repository.confirmHold({ holdId: first.id, idempotencyKey: "idem-band-1", customer: customerFor("Prima") });

    // Un secondo tavolo alle 19:00 esisterebbe ancora, ma la fascia è già piena.
    const afterFirst = checkAvailability(availability, await repository.getAvailabilityContext());
    expect(afterFirst.availableOptions.some((slot) => slot.startAt === option.startAt)).toBe(false);

    await expect(repository.createHold({ availability, startAt: option.startAt, sessionId: "session-band-2" }))
      .rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("lascia libero un orario fuori dalla fascia configurata", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    await repository.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 1 });

    const availability = { locationId: ardea.id, date, requestedTime: "20:00", partySize: 2, source: "web" as const };
    const result = checkAvailability(availability, await repository.getAvailabilityContext());
    expect(result.availableOptions.length).toBeGreaterThan(0);
  });

  it("un limite sospeso non blocca più nulla", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    const band = await repository.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 1 });
    const availability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: "session-suspend-1" });
    await repository.confirmHold({ holdId: hold.id, idempotencyKey: "idem-suspend-1", customer: customerFor("Prima") });

    await repository.updateCapacityBand(band.id, { isActive: false });
    const afterSuspend = checkAvailability(availability, await repository.getAvailabilityContext());
    expect(afterSuspend.availableOptions.some((slot) => slot.startAt === option.startAt)).toBe(true);
  });

  it("non attraversa mai le sedi: la fascia di Ardea non tocca Portici", async () => {
    const ardeaRepo = new MemoryReservationRepository(ardea.id);
    const porticiRepo = new MemoryReservationRepository(portici.id);
    await ardeaRepo.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 1 });

    const [ardeaBands, porticiBands] = await Promise.all([ardeaRepo.listCapacityBands(), porticiRepo.listCapacityBands()]);
    expect(ardeaBands).toHaveLength(1);
    expect(porticiBands).toHaveLength(0);

    const availability = { date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const porticiResult = checkAvailability({ ...availability, locationId: portici.id }, await porticiRepo.getAvailabilityContext());
    expect(porticiResult.availableOptions.length).toBeGreaterThan(0);
  });

  it("serializza i tentativi in gara sulla stessa fascia: uno solo vince", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    await repository.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 2 });
    const availability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];

    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) => repository.createHold({ availability, startAt: option.startAt, sessionId: `band-race-${index}` })),
    );
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(2);
    expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(2);
  });
});

describe("prenotazione manuale dello staff", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("occupa il tavolo e scala la disponibilità come una prenotazione online", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    const availability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "phone_staff" as const };
    const before = checkAvailability(availability, await repository.getAvailabilityContext());
    const option = before.availableOptions[0];
    expect(option).toBeDefined();

    const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: "staff_test-session" });
    const confirmed = await repository.confirmHold({ holdId: hold.id, idempotencyKey: "idem-staff-1", customer: customerFor("Telefono") });

    expect(confirmed.reservation.source).toBe("phone_staff");
    expect(confirmed.reservation.tableIds.length).toBeGreaterThan(0);
    const reservations = await repository.listReservations();
    expect(reservations.some((row) => row.id === confirmed.reservation.id)).toBe(true);
  });

  it("rispetta lo stesso limite di fascia di una prenotazione online", async () => {
    const repository = new MemoryReservationRepository(ardea.id);
    await repository.createCapacityBand({ startTime: "19:00", endTime: "19:30", maxArrivals: 1 });
    const webAvailability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const option = checkAvailability(webAvailability, await repository.getAvailabilityContext()).availableOptions[0];
    const webHold = await repository.createHold({ availability: webAvailability, startAt: option.startAt, sessionId: "session-web-first" });
    await repository.confirmHold({ holdId: webHold.id, idempotencyKey: "idem-web-first", customer: customerFor("Online") });

    // Chi chiama subito dopo non deve poter passare dal telefono per superare
    // lo stesso limite che ha appena fermato il sito.
    const staffAvailability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "phone_staff" as const };
    await expect(repository.createHold({ availability: staffAvailability, startAt: option.startAt, sessionId: "staff_after-web" }))
      .rejects.toBeInstanceOf(SlotUnavailableError);
  });

  it("non lascia la disponibilità di Portici toccata da una prenotazione manuale ad Ardea", async () => {
    const ardeaRepo = new MemoryReservationRepository(ardea.id);
    const porticiRepo = new MemoryReservationRepository(portici.id);
    const availability = { locationId: ardea.id, date, requestedTime: "19:00", partySize: 2, source: "phone_staff" as const };
    const option = checkAvailability(availability, await ardeaRepo.getAvailabilityContext()).availableOptions[0];
    const hold = await ardeaRepo.createHold({ availability, startAt: option.startAt, sessionId: "staff_cross-check" });
    await ardeaRepo.confirmHold({ holdId: hold.id, idempotencyKey: "idem-cross-check", customer: customerFor("Ardea") });

    const porticiAvailability = { locationId: portici.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const porticiResult = checkAvailability(porticiAvailability, await porticiRepo.getAvailabilityContext());
    expect(porticiResult.availableOptions.length).toBeGreaterThan(0);
    expect((await porticiRepo.listReservations()).length).toBe((await new MemoryReservationRepository(portici.id).listReservations()).length);
  });
});
