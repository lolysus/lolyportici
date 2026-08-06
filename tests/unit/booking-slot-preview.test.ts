import { describe, expect, it } from "vitest";
import { previewBookingSlots } from "@/lib/service-calendar";

const aperta = (startTime: string, endTime: string) => ({ enabled: true, startTime, endTime });

describe("orari proposti a chi prenota", () => {
  it("parte dall'apertura e si ferma in tempo per l'ultima permanenza", () => {
    // Cena 19:00–23:00, permanenza minima 90 minuti: l'ultimo orario è 21:30,
    // non 23:00, altrimenti si accetterebbe un tavolo che non fa in tempo.
    expect(previewBookingSlots(aperta("19:00", "23:00"), 30, 90))
      .toEqual(["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"]);
  });

  it("segue l'intervallo scelto", () => {
    expect(previewBookingSlots(aperta("12:00", "14:00"), 15, 60))
      .toEqual(["12:00", "12:15", "12:30", "12:45", "13:00"]);
    expect(previewBookingSlots(aperta("12:00", "15:00"), 60, 60))
      .toEqual(["12:00", "13:00", "14:00"]);
  });

  it("non propone nulla quando il servizio è spento", () => {
    expect(previewBookingSlots({ enabled: false, startTime: "19:00", endTime: "23:00" }, 30, 90)).toEqual([]);
  });

  it("non propone nulla se la fascia non contiene nemmeno una permanenza", () => {
    // Un'ora di apertura con permanenza minima di due: nessun orario è
    // servibile, ed è meglio dirlo che mostrarne uno che poi fallisce.
    expect(previewBookingSlots(aperta("19:00", "20:00"), 30, 120)).toEqual([]);
  });

  it("regge orari malformati o invertiti senza inventare slot", () => {
    expect(previewBookingSlots(aperta("25:00", "23:00"), 30, 90)).toEqual([]);
    expect(previewBookingSlots(aperta("", ""), 30, 90)).toEqual([]);
    expect(previewBookingSlots(aperta("23:00", "19:00"), 30, 90)).toEqual([]);
  });

  it("non va in ciclo infinito con un intervallo assurdo", () => {
    // Zero o negativo azzererebbe l'avanzamento del cursore: ricade su 30.
    expect(previewBookingSlots(aperta("19:00", "21:00"), 0, 60)).toEqual(["19:00", "19:30", "20:00"]);
    expect(previewBookingSlots(aperta("19:00", "21:00"), -15, 60)).toEqual(["19:00", "19:30", "20:00"]);
  });

  it("con permanenza a zero arriva fino alla chiusura", () => {
    expect(previewBookingSlots(aperta("19:00", "20:00"), 30, 0)).toEqual(["19:00", "19:30", "20:00"]);
  });
});
