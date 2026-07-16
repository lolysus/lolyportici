import { beforeEach, describe, expect, it } from "vitest";
import { checkAvailability } from "@/domains/availability/availability-service";
import { SlotUnavailableError } from "@/domains/bookings/errors";
import { restaurantConfig } from "@/config/brand";
import { dateKeyInZone } from "@/lib/datetime";
import { demoServices } from "@/repositories/demo-data";
import {
  MemoryReservationRepository,
  resetMemoryRepositoryForTests,
} from "@/repositories/memory-repository";

const today = dateKeyInZone(new Date());
const tomorrow = new Date(`${today}T12:00:00.000Z`);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);

describe("memory booking repository", () => {
  beforeEach(() => resetMemoryRepositoryForTests());

  it("offers lunch only on Saturday and Sunday", () => {
    expect(demoServices.filter((service) => service.name === "Pranzo").map((service) => service.dayOfWeek)).toEqual([0, 6]);
  });

  it("confirms a hold idempotently and exposes the management token", async () => {
    const repository = new MemoryReservationRepository();
    const availability = {
      locationId: restaurantConfig.locationId,
      date,
      requestedTime: "19:00",
      partySize: 2,
      source: "web" as const,
    };
    const result = checkAvailability(availability, await repository.getAvailabilityContext());
    const option = result.availableOptions[0];
    expect(option).toBeDefined();

    const hold = await repository.createHold({
      availability,
      startAt: option.startAt,
      sessionId: "test-session-0001",
    });
    const command = {
      holdId: hold.id,
      idempotencyKey: "idempotency-test-0001",
      customer: {
        firstName: "Luca",
        lastName: "Test",
        phone: "+39 333 123 0000",
        email: "LUCA.TEST@example.com",
        preferredLanguage: "it",
        marketingConsent: false,
        privacyConsent: true,
      },
    };
    const first = await repository.confirmHold(command);
    const replay = await repository.confirmHold(command);

    expect(replay).toEqual(first);
    expect(await repository.findReservationByToken(first.managementToken)).toMatchObject({
      id: first.reservation.id,
      status: "confirmed",
    });
    expect((await repository.listEvents())[0]?.eventType).toBe("reservation_confirmed");
  });

  it("serializes simultaneous holds and rejects requests after final capacity is held", async () => {
    const repository = new MemoryReservationRepository();
    const availability = {
      locationId: restaurantConfig.locationId,
      date,
      requestedTime: "19:00",
      partySize: 8,
      source: "web" as const,
    };
    const option = checkAvailability(availability, await repository.getAvailabilityContext()).availableOptions[0];
    expect(option).toBeDefined();

    const attempts = await Promise.allSettled(
      Array.from({ length: 4 }, (_, index) =>
        repository.createHold({
          availability,
          startAt: option.startAt,
          sessionId: `parallel-session-${index}`,
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(3);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.status === "rejected") expect(rejected.reason).toBeInstanceOf(SlotUnavailableError);
  });
});
