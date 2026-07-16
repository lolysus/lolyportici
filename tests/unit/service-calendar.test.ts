import { describe, expect, it } from "vitest";
import {
  buildReservationLanes,
  buildServiceTimeSlots,
  firstBookableServiceDate,
  isBookableServiceDate,
} from "@/lib/service-calendar";

describe("service calendar helpers", () => {
  it("uses the service frequency instead of a fixed dinner grid", () => {
    expect(buildServiceTimeSlots({ startTime: "12:00", endTime: "14:00", slotIntervalMinutes: 20 })).toEqual([
      "12:00", "12:20", "12:40", "13:00", "13:20", "13:40",
    ]);
  });

  it("keeps dates inside the opening window, scheduled days and closures", () => {
    const rules = {
      firstDate: "2031-05-19",
      maximumAdvanceDays: 7,
      enabledWeekdays: [1, 3, 5],
      closedDates: ["2031-05-21"],
    };
    expect(isBookableServiceDate("2031-05-19", rules)).toBe(true);
    expect(isBookableServiceDate("2031-05-20", rules)).toBe(false);
    expect(isBookableServiceDate("2031-05-21", rules)).toBe(false);
    expect(firstBookableServiceDate({ ...rules, closedDates: ["2031-05-19", "2031-05-21"] })).toBe("2031-05-23");
  });

  it("does not select a disabled day when no online date exists", () => {
    expect(firstBookableServiceDate({
      firstDate: "2031-05-19",
      maximumAdvanceDays: 2,
      enabledWeekdays: [],
    })).toBeNull();
  });

  it("places overlapping bookings in separate operational lanes", () => {
    const lanes = buildReservationLanes([
      { startAt: "2031-05-19T19:00:00.000Z", endAt: "2031-05-19T20:30:00.000Z" },
      { startAt: "2031-05-19T19:30:00.000Z", endAt: "2031-05-19T21:00:00.000Z" },
      { startAt: "2031-05-19T20:30:00.000Z", endAt: "2031-05-19T21:30:00.000Z" },
    ]);
    expect(lanes).toHaveLength(2);
    expect(lanes[0]).toHaveLength(2);
  });
});
