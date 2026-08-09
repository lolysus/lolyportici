import { describe, expect, it } from "vitest";
import { receiptFileName } from "@/lib/booking-receipt";

/**
 * Il disegno su `<canvas>` non è verificabile qui: i test girano su Node, senza
 * DOM. Quello che si può inchiodare — e che è la parte che il cliente vede in
 * galleria — è il nome del file, dove finisce il codice della prenotazione.
 */
describe("nome del file della ricevuta", () => {
  it("porta il codice della prenotazione, non un nome anonimo", () => {
    expect(receiptFileName("YK-A1B2C3")).toBe("prenotazione-yk-a1b2c3.png");
  });

  it("regge un codice con spazi o caratteri fuori posto", () => {
    // Un nome file con spazi o slash rompe il salvataggio su alcuni telefoni, e
    // uno slash lo trasformerebbe in un percorso.
    expect(receiptFileName("  KS 99/77  ")).toBe("prenotazione-ks-99-77.png");
  });

  it("non produce trattini appesi in testa o in coda", () => {
    expect(receiptFileName("--KS-1--")).toBe("prenotazione-ks-1.png");
  });

  it("resta un nome valido anche con un codice vuoto", () => {
    // Non deve mai uscire "prenotazione-.png": meglio una parola sensata.
    expect(receiptFileName("")).toBe("prenotazione-conferma.png");
    expect(receiptFileName("///")).toBe("prenotazione-conferma.png");
  });

  it("finisce sempre in .png, perché è quello che genera", () => {
    expect(receiptFileName("KS-1")).toMatch(/\.png$/);
  });
});
