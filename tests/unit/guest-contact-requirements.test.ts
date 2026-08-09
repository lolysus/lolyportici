import { describe, expect, it } from "vitest";
import { reservationCreateSchema, webReservationCreateSchema } from "@/validators/booking";

/**
 * Questo file verificava il contrario: che il web **pretendesse** un'email.
 * Aveva senso quando la conferma al cliente partiva per posta — senza indirizzo
 * l'ospite restava senza codice. Ora la conferma si legge a schermo e si scarica
 * come immagine, e nessuna email viene inviata: pretendere un indirizzo per non
 * usarlo escludeva chi non ce l'ha e raccoglieva un dato personale a vuoto.
 *
 * Resta il confronto fra i canali, perché è la domanda che questo file pone: web
 * e telefono ora chiedono le stesse cose, e devono restare allineati.
 */

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
  it("accepts a web booking without an email", () => {
    expect(webReservationCreateSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a web booking with a malformed email", () => {
    // Un indirizzo storto è peggio di nessun indirizzo: sembra un recapito
    // valido e il ristorante ci conta.
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
    expect(reservationCreateSchema.safeParse(base).success).toBe(true);
  });

  it("asks the same things on both channels", () => {
    // Se un domani il web tornasse a chiedere un campo in più, questo caso lo
    // segnala: due canali che divergono in silenzio producono prenotazioni
    // valide da una parte e rifiutate dall'altra senza che nessuno sappia perché.
    const withoutPhone = { ...base, customer: { ...base.customer, phone: "" } };
    expect(webReservationCreateSchema.safeParse(withoutPhone).success)
      .toBe(reservationCreateSchema.safeParse(withoutPhone).success);
    expect(webReservationCreateSchema.safeParse(base).success)
      .toBe(reservationCreateSchema.safeParse(base).success);
  });
});
