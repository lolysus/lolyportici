import { describe, expect, it } from "vitest";
import { dateKeyInZone, formatTimeInZone, localDateTimeToUtc } from "@/lib/datetime";

describe("Europe/Rome date conversion", () => {
  it("applies winter and summer offsets without changing the restaurant wall clock", () => {
    const winter = localDateTimeToUtc("2031-01-20", "19:00");
    const summer = localDateTimeToUtc("2031-05-20", "19:00");
    expect(winter.toISOString()).toBe("2031-01-20T18:00:00.000Z");
    expect(summer.toISOString()).toBe("2031-05-20T17:00:00.000Z");
    expect(formatTimeInZone(winter)).toBe("19:00");
    expect(formatTimeInZone(summer)).toBe("19:00");
    expect(dateKeyInZone(summer)).toBe("2031-05-20");
  });
});
