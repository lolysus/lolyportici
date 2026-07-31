import { describe, expect, it } from "vitest";
import { reservationCreateSchema, webReservationCreateSchema } from "@/validators/booking";

const base = {
  locationId: "00000000-0000-0000-0000-000000000003",
  holdId: "00000000-0000-0000-0000-0000000000aa",
  idempotencyKey: "0123456789abcdef0123",
  customer: {
    firstName: "Giulia",
    lastName: "Rossi",
    phone: "3331234567",
    privacyConsent: true as const,
  },
};

describe("guest contact requirements per channel", () => {
  it("refuses a web booking without an email", () => {
    // Senza indirizzo la prenotazione riuscirebbe e l'ospite non riceverebbe
    // nulla: nessuna conferma, nessun codice per modificare o annullare.
    const parsed = webReservationCreateSchema.safeParse(base);
    expect(parsed.success).toBe(false);
  });

  it("refuses a web booking with a malformed email", () => {
    const parsed = webReservationCreateSchema.safeParse({
      ...base,
      customer: { ...base.customer, email: "giulia.rossi" },
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a web booking with a valid email", () => {
    const parsed = webReservationCreateSchema.safeParse({
      ...base,
      customer: { ...base.customer, email: "giulia.rossi@example.test" },
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts a phone booking without an email", () => {
    // Al telefono l'indirizzo spesso non è ottenibile: l'agente vocale deve
    // poter chiudere comunque la prenotazione.
    const parsed = reservationCreateSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });
});
