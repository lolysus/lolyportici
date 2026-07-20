import { beforeEach, describe, expect, it } from "vitest";
import { PATCH as updateReservation, DELETE as cancelReservation } from "@/app/api/public/v1/reservations/manage/[token]/route";
import { DELETE as releaseHold } from "@/app/api/public/v1/holds/route";
import { restaurantLocations } from "@/config/brand";
import { checkAvailability } from "@/domains/availability/availability-service";
import { InvalidWaitlistStateError } from "@/domains/bookings/errors";
import { dateKeyInZone } from "@/lib/datetime";
import { findReservationForManagementToken } from "@/lib/public-reservation";
import { MemoryReservationRepository, resetMemoryRepositoryForTests } from "@/repositories/memory-repository";

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

async function createConfirmed(repository: MemoryReservationRepository, locationId: string) {
  const availability = { locationId, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
  const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
  if (!option) throw new Error("No slot available for test setup");
  const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: `guardrail-${locationId.slice(0, 12)}` });
  return repository.confirmHold({
    holdId: hold.id,
    idempotencyKey: `guardrail-confirm-${locationId}-${Date.now()}`,
    customer: { firstName: "Marta", lastName: "Flusso", phone: `+3933300${locationId.slice(-4)}`, preferredLanguage: "it", marketingConsent: false, privacyConsent: true },
  });
}

describe("booking flow guardrails", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("resolves a management token only in the restaurant that owns the reservation", async () => {
    const kouSushi = restaurantLocations.find((location) => location.slug === "kousushi");
    expect(kouSushi).toBeDefined();
    if (!kouSushi) return;
    const confirmed = await createConfirmed(new MemoryReservationRepository(kouSushi.id), kouSushi.id);
    const match = await findReservationForManagementToken(confirmed.managementToken);

    expect(match?.location.id).toBe(kouSushi.id);
    expect(match?.reservation.locationId).toBe(kouSushi.id);
  });

  it("keeps a notes-only change in its active status and refuses changes after arrival", async () => {
    const yuko = restaurantLocations.find((location) => location.slug === "yuko");
    expect(yuko).toBeDefined();
    if (!yuko) return;
    const repository = new MemoryReservationRepository(yuko.id);
    const confirmed = await createConfirmed(repository, yuko.id);

    const notesResponse = await updateReservation(new Request(`http://localhost/api/public/v1/reservations/manage/${confirmed.managementToken}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-forwarded-for": "guardrail-notes" },
      body: JSON.stringify({ customerNotes: "Compleanno", allergies: "Sesamo" }),
    }), { params: Promise.resolve({ token: confirmed.managementToken }) } as never);
    const notesBody = await notesResponse.json();
    expect(notesResponse.status).toBe(200);
    expect(notesBody.data.status).toBe("confirmed");
    expect(notesBody.data.customer.allergies).toBe("Sesamo");
    await repository.updateReservationByStaff(confirmed.reservation.id, { status: "arrived" });

    const response = await updateReservation(new Request(`http://localhost/api/public/v1/reservations/manage/${confirmed.managementToken}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-forwarded-for": "guardrail-arrived" },
      body: JSON.stringify({ partySize: 3 }),
    }), { params: Promise.resolve({ token: confirmed.managementToken }) } as never);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("MODIFICATION_NOT_ALLOWED");
  });

  it("makes customer cancellation safe to retry after a successful cancellation", async () => {
    const yuko = restaurantLocations.find((location) => location.slug === "yuko");
    expect(yuko).toBeDefined();
    if (!yuko) return;
    const confirmed = await createConfirmed(new MemoryReservationRepository(yuko.id), yuko.id);
    const request = () => new Request(`http://localhost/api/public/v1/reservations/manage/${confirmed.managementToken}`, {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-forwarded-for": "guardrail-cancel" },
      body: JSON.stringify({ reason: "Cambio programma" }),
    });

    const first = await cancelReservation(request(), { params: Promise.resolve({ token: confirmed.managementToken }) } as never);
    const second = await cancelReservation(request(), { params: Promise.resolve({ token: confirmed.managementToken }) } as never);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).data.status).toBe("cancelled_by_customer");
  });

  it("allows waitlist entries to progress only through the defined cascade", async () => {
    const yuko = restaurantLocations.find((location) => location.slug === "yuko");
    expect(yuko).toBeDefined();
    if (!yuko) return;
    const repository = new MemoryReservationRepository(yuko.id);
    const entry = await repository.addWaitlist({ customer: { firstName: "Anna", lastName: "Coda", phone: "+393331234567" }, requestedDate: date, requestedStartAt: `${date}T19:00:00.000Z`, partySize: 2, flexibilityMinutes: 30 });

    await expect(repository.updateWaitlist(entry.id, "converted")).rejects.toBeInstanceOf(InvalidWaitlistStateError);
    expect((await repository.updateWaitlist(entry.id, "offered")).status).toBe("offered");
    expect((await repository.updateWaitlist(entry.id, "converted")).status).toBe("converted");
  });

  it("releases a temporary hold only for its restaurant and browser session", async () => {
    const yuko = restaurantLocations.find((location) => location.slug === "yuko");
    const kouSushi = restaurantLocations.find((location) => location.slug === "kousushi");
    expect(yuko).toBeDefined();
    expect(kouSushi).toBeDefined();
    if (!yuko || !kouSushi) return;
    const repository = new MemoryReservationRepository(kouSushi.id);
    const availability = { locationId: kouSushi.id, date, requestedTime: "19:00", partySize: 2, source: "web" as const };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    if (!option) throw new Error("No slot available for test setup");
    const hold = await repository.createHold({ availability, startAt: option.startAt, sessionId: "guardrail-hold-session" });

    const response = await releaseHold(new Request("http://localhost/api/public/v1/holds", {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-forwarded-for": "guardrail-hold-release" },
      body: JSON.stringify({ holdId: hold.id, locationId: yuko.id, sessionId: hold.sessionId }),
    }));
    expect(response.status).toBe(200);
    await expect(repository.confirmHold({
      holdId: hold.id,
      idempotencyKey: "guardrail-hold-remains-active",
      customer: { firstName: "Lucia", lastName: "Hold", phone: "+393330001111", preferredLanguage: "it", marketingConsent: false, privacyConsent: true },
    })).resolves.toMatchObject({ reservation: { locationId: kouSushi.id } });
  });
});
