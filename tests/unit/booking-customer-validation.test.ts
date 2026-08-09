import { describe, expect, it } from "vitest";
import { webReservationCreateSchema } from "@/validators/booking";

const base = {
  locationId: "00000000-0000-0000-0000-000000000003",
  holdId: "30000000-0000-0000-0000-000000000001",
  idempotencyKey: "idempotency-key-abcdef123456",
};

function customer(overrides: Record<string, unknown> = {}) {
  return { firstName: "Luca", lastName: "Rossi", phone: "+393330000000", privacyConsent: true, ...overrides };
}

describe("dati del cliente sul canale web", () => {
  it("accetta una prenotazione senza email", () => {
    // L'email è facoltativa: nessuna conferma parte per posta, e pretendere un
    // indirizzo per non usarlo era raccogliere un dato personale a vuoto.
    const parsed = webReservationCreateSchema.safeParse({ ...base, customer: customer() });
    expect(parsed.success).toBe(true);
  });

  it("accetta anche l'email lasciata vuota dal modulo", () => {
    expect(webReservationCreateSchema.safeParse({ ...base, customer: customer({ email: "" }) }).success).toBe(true);
  });

  it("rifiuta un'email scritta male, che è peggio di nessuna email", () => {
    expect(webReservationCreateSchema.safeParse({ ...base, customer: customer({ email: "luca@" }) }).success).toBe(false);
  });

  it("conserva l'email quando c'è ed è valida", () => {
    const parsed = webReservationCreateSchema.safeParse({ ...base, customer: customer({ email: "luca@example.it" }) });
    expect(parsed.success && parsed.data.customer.email).toBe("luca@example.it");
  });

  it.each([
    ["nome", { firstName: "" }],
    ["cognome", { lastName: "" }],
    ["cellulare", { phone: "" }],
  ])("rifiuta la prenotazione senza %s", (_field, missing) => {
    expect(webReservationCreateSchema.safeParse({ ...base, customer: customer(missing) }).success).toBe(false);
  });

  it("rifiuta un cellulare troppo corto per essere un numero", () => {
    expect(webReservationCreateSchema.safeParse({ ...base, customer: customer({ phone: "123" }) }).success).toBe(false);
  });

  it("rifiuta la prenotazione senza consenso privacy, anche se dichiarato falso", () => {
    // `literal(true)`: l'assenza e il rifiuto devono fallire entrambi, altrimenti
    // basterebbe non spedire il campo per aggirare il consenso.
    expect(webReservationCreateSchema.safeParse({ ...base, customer: customer({ privacyConsent: false }) }).success).toBe(false);
    const { privacyConsent: _omitted, ...withoutConsent } = customer();
    void _omitted;
    expect(webReservationCreateSchema.safeParse({ ...base, customer: withoutConsent }).success).toBe(false);
  });

  it("il consenso marketing resta spento se nessuno lo accende", () => {
    const parsed = webReservationCreateSchema.safeParse({ ...base, customer: customer() });
    expect(parsed.success && parsed.data.customer.marketingConsent).toBe(false);
  });
});
