import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendReservationConfirmation } from "@/domains/notifications/notification-service";
import type { PublicReservation } from "@/repositories/repository";

const reservation: PublicReservation = {
  id: "60000000-0000-0000-0000-000000000099",
  organizationId: "00000000-0000-0000-0000-000000000001",
  restaurantId: "00000000-0000-0000-0000-000000000002",
  locationId: "00000000-0000-0000-0000-000000000003",
  customerId: "50000000-0000-0000-0000-000000000099",
  servicePeriodId: "40000000-0000-0000-0000-000000000001",
  reservationCode: "MG-TEST",
  source: "web",
  status: "confirmed",
  partySize: 2,
  reservationDate: "2031-05-20",
  startAt: "2031-05-20T17:00:00.000Z",
  endAt: "2031-05-20T18:45:00.000Z",
  durationMinutes: 90,
  tableIds: ["20000000-0000-0000-0000-000000000001"],
  customer: {
    id: "50000000-0000-0000-0000-000000000099",
    firstName: "Luca",
    lastName: "Test",
    phone: "+393330000000",
    email: "luca@example.test",
    preferredLanguage: "it",
    marketingConsent: false,
    privacyConsent: true,
    customerType: "new",
    totalBookings: 1,
    noShowCount: 0,
  },
  language: "it",
  createdAt: "2031-05-01T00:00:00.000Z",
  updatedAt: "2031-05-01T00:00:00.000Z",
};

describe("notification service", () => {
  beforeEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.TELNYX_API_KEY;
    delete process.env.TELNYX_FROM_NUMBER;
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("sends email and SMS through sandbox adapters without losing the booking", async () => {
    await expect(sendReservationConfirmation(reservation)).resolves.toEqual({ status: "sandbox", attempts: 2, failed: 0, sandbox: 2 });
  });

  it("uses SMS only when the customer has no email", async () => {
    const withoutEmail = { ...reservation, customer: { ...reservation.customer, email: undefined } };
    await expect(sendReservationConfirmation(withoutEmail)).resolves.toEqual({ status: "sandbox", attempts: 1, failed: 0, sandbox: 1 });
  });

  it("respects the per-location confirmation channels", async () => {
    await expect(sendReservationConfirmation(reservation, { emailEnabled: true, smsEnabled: false }))
      .resolves.toEqual({ status: "sandbox", attempts: 1, failed: 0, sandbox: 1 });
    await expect(sendReservationConfirmation(reservation, { emailEnabled: false, smsEnabled: false }))
      .resolves.toEqual({ status: "disabled", attempts: 0, failed: 0, sandbox: 0 });
  });
});
