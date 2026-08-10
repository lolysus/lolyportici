import { describe, expect, it } from "vitest";
import { dateKeyFromRow } from "@/repositories/postgres-repository";

/**
 * Il difetto che questo file impedisce di ripetere.
 *
 * Le colonne `date` di Postgres arrivano come oggetti `Date`. Venivano convertite
 * con un helper che accetta solo stringhe e altrimenti restituisce `""`: ogni
 * `reservation_date` era quindi vuota, e con essa vuota l'agenda — che filtra le
 * righe per giorno — i contatori della giornata, l'export CSV e le metriche.
 *
 * Era invisibile: nessun errore, nessun log, solo una schermata che diceva "zero
 * prenotazioni" per qualunque data in un pannello con prenotazioni vere.
 */
describe("conversione delle colonne data di Postgres", () => {
  it("accetta un oggetto Date, che è ciò che il driver restituisce", () => {
    expect(dateKeyFromRow(new Date("2026-07-30T00:00:00.000Z"))).toBe("2026-07-30");
  });

  it("tiene il giorno anche con un orario dentro la data", () => {
    expect(dateKeyFromRow(new Date("2026-08-04T22:45:00.000Z"))).toBe("2026-08-04");
  });

  it("accetta anche una stringa, per chi la passa già pronta", () => {
    expect(dateKeyFromRow("2026-08-12")).toBe("2026-08-12");
    expect(dateKeyFromRow("2026-08-12T19:00:00.000Z")).toBe("2026-08-12");
  });

  it("non produce una data finta da un valore assente", () => {
    // Meglio vuoto che una data inventata: un filtro che non trova nulla si
    // nota, una data sbagliata no.
    expect(dateKeyFromRow(null)).toBe("");
    expect(dateKeyFromRow(undefined)).toBe("");
    expect(dateKeyFromRow(12345)).toBe("");
  });

  it("rispetta il valore di ripiego richiesto", () => {
    expect(dateKeyFromRow(null, "1970-01-01")).toBe("1970-01-01");
  });

  it("produce sempre una chiave confrontabile con quelle dell'agenda", () => {
    // L'agenda confronta con stringhe `YYYY-MM-DD`: la forma deve combaciare
    // esattamente, altrimenti il filtro fallisce in silenzio.
    expect(dateKeyFromRow(new Date("2026-12-31T00:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
