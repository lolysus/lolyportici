import { describe, expect, it } from "vitest";
import {
  calculateDuration,
  checkAvailability,
  findBestTableAssignment,
  rangesOverlap,
  type AvailabilityContext,
} from "@/domains/availability/availability-service";
import type { AvailabilityInput } from "@/types/api";
import type { ServicePeriod, TableResource } from "@/types/domain";
import { formatTimeInZone, localDateTimeToUtc } from "@/lib/datetime";

const date = "2031-05-20";
const areaId = "10000000-0000-0000-0000-000000000001";
const locationId = "00000000-0000-0000-0000-000000000003";

function table(id: string, capacity: number, strategic = false): TableResource {
  return {
    id,
    code: id,
    displayName: id,
    diningAreaId: areaId,
    diningAreaName: "Sala interna",
    minimumCapacity: 1,
    maximumCapacity: capacity,
    shape: "round",
    positionX: 0,
    positionY: 0,
    width: 80,
    height: 80,
    isAccessible: false,
    isOutdoor: false,
    isStrategic: strategic,
    status: "available",
  };
}

function context(overrides: Partial<AvailabilityContext> = {}): AvailabilityContext {
  const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  const service: ServicePeriod = {
    id: "40000000-0000-0000-0000-000000000001",
    name: "Cena",
    dayOfWeek,
    startTime: "19:00",
    endTime: "23:30",
    slotIntervalMinutes: 30,
    defaultDurationMinutes: 120,
    turnaroundMinutes: 15,
    maximumCovers: 20,
    maximumArrivalsPerSlot: 4,
    onlineBookingEnabled: true,
    phoneBookingEnabled: true,
    isActive: true,
  };
  return {
    tables: [
      table("20000000-0000-0000-0000-000000000001", 2),
      table("20000000-0000-0000-0000-000000000002", 4),
      table("20000000-0000-0000-0000-000000000003", 8, true),
    ],
    combinations: [],
    servicePeriods: [service],
    reservations: [],
    holds: [],
    closures: [],
    now: new Date("2031-05-19T12:00:00.000Z"),
    ...overrides,
  };
}

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return { locationId, date, partySize: 2, source: "web", ...overrides };
}

describe("availability service", () => {
  it("applies the duration policy by party size", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map((size) => calculateDuration(size))).toEqual([
      90, 90, 120, 120, 150, 150, 180,
    ]);
    expect(calculateDuration(2, 135)).toBe(135);
  });

  it("treats adjacent reservations as non-overlapping", () => {
    expect(rangesOverlap("2031-05-20T19:00:00.000Z", "2031-05-20T20:00:00.000Z", "2031-05-20T20:00:00.000Z", "2031-05-20T21:00:00.000Z")).toBe(false);
    expect(rangesOverlap("2031-05-20T19:00:00.000Z", "2031-05-20T20:01:00.000Z", "2031-05-20T20:00:00.000Z", "2031-05-20T21:00:00.000Z")).toBe(true);
  });

  it("assigns the smallest efficient table and preserves strategic capacity", () => {
    const assignment = findBestTableAssignment(
      { partySize: 2 },
      context(),
      `${date}T19:00:00.000Z`,
      `${date}T20:45:00.000Z`,
    );
    expect(assignment?.tableIds).toEqual(["20000000-0000-0000-0000-000000000001"]);
  });

  it("excludes active holds and proposes nearby alternatives", () => {
    const startAt = localDateTimeToUtc(date, "19:00").toISOString();
    const result = checkAvailability(
      input({ requestedTime: "19:00" }),
      context({
        tables: [table("20000000-0000-0000-0000-000000000001", 2)],
        holds: [{
          id: "90000000-0000-0000-0000-000000000001",
          locationId,
          sessionId: "session-active",
          partySize: 2,
          startAt,
          endAt: localDateTimeToUtc(date, "20:45").toISOString(),
          tableIds: ["20000000-0000-0000-0000-000000000001"],
          diningAreaId: areaId,
          expiresAt: localDateTimeToUtc(date, "18:55").toISOString(),
          status: "active",
          createdAt: localDateTimeToUtc(date, "18:40").toISOString(),
        }],
        now: localDateTimeToUtc(date, "18:50"),
      }),
    );
    expect(result.requestedSlotAvailable).toBe(false);
    expect(formatTimeInZone(result.alternativeSlots[0]!.startAt)).toBe("21:00");
  });

  it("blocks large groups for manual approval and full closures", () => {
    const largeParty = checkAvailability(input({ partySize: 11 }), context());
    expect(largeParty.requiresManualApproval).toBe(true);
    expect(largeParty.availableOptions).toHaveLength(0);

    const closed = checkAvailability(
      input(),
      context({ closures: [{ id: "closure", date, type: "full_closure", reason: "Evento privato" }] }),
    );
    expect(closed.availableOptions).toHaveLength(0);
    expect(closed.restrictions).toHaveLength(1);
  });

  it("explains any whole-venue closure, not only a full-closure label", () => {
    const closed = checkAvailability(
      input(),
      context({ closures: [{ id: "maintenance", date, type: "maintenance", reason: "Intervento tecnico" }] }),
    );
    expect(closed.availableOptions).toHaveLength(0);
    expect(closed.restrictions).toContain("Il ristorante è chiuso nella data selezionata: Intervento tecnico.");
  });

  it("routes deposit-required bookings to manual confirmation", () => {
    const result = checkAvailability(input(), context({ bookingConstraints: {
      minimumPartySize: 1,
      maximumPartySize: 10,
      minimumNoticeMinutes: 0,
      maximumAdvanceDays: 90,
      requiresManualApproval: false,
      requiresDeposit: true,
      depositAmount: 25,
    } }));
    expect(result.requiresManualApproval).toBe(true);
    expect(result.availableOptions).toHaveLength(0);
    expect(result.restrictions).toContain("È richiesto un deposito di € 25.00 e la conferma del personale.");
  });

  it("enforces notice and advance windows from the booking rule", () => {
    const constrained = context({
      now: localDateTimeToUtc(date, "18:30"),
      bookingConstraints: {
        minimumPartySize: 1,
        maximumPartySize: 10,
        minimumNoticeMinutes: 60,
        maximumAdvanceDays: 90,
        requiresManualApproval: false,
      },
    });
    const result = checkAvailability(input(), constrained);
    expect(formatTimeInZone(result.availableOptions[0]!.startAt)).toBe("19:30");

    const tooFar = checkAvailability(input({ date: "2031-08-20" }), constrained);
    expect(tooFar.availableOptions).toHaveLength(0);
    expect(tooFar.restrictions[0]).toContain("90 giorni");
  });

  it("removes only the affected resource for a partial closure", () => {
    const closedTableId = "20000000-0000-0000-0000-000000000001";
    const result = checkAvailability(input({ requestedTime: "19:00" }), context({
      closures: [{ id: "partial", date, type: "partial_closure", reason: "Manutenzione", affectedTableId: closedTableId }],
    }));
    expect(result.requestedSlotAvailable).toBe(true);
    expect(result.availableOptions[0]!.tableIds).not.toContain(closedTableId);
  });
});
