import { describe, expect, it } from "vitest";
import { InvalidReservationStateError } from "@/domains/bookings/errors";
import { assertTransition, canTransition } from "@/domains/bookings/state-machine";
import { normalizeEmail, normalizePhone } from "@/domains/customers/normalization";

describe("reservation state machine", () => {
  it("allows only declared operational transitions", () => {
    expect(canTransition("confirmed", "arrived")).toBe(true);
    expect(canTransition("completed", "confirmed")).toBe(false);
    expect(() => assertTransition("seated", "cancelled_by_customer")).toThrow(InvalidReservationStateError);
  });
});

describe("customer normalization", () => {
  it("normalizes email and phone identity keys", () => {
    expect(normalizeEmail("  Ospite@Example.COM ")).toBe("ospite@example.com");
    expect(normalizePhone("+39 333-123 4567")).toBe("+393331234567");
  });
});
