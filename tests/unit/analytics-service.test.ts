import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/domains/analytics/analytics-service";
import type { PublicReservation } from "@/repositories/repository";
import type { ReservationSource, ReservationStatus } from "@/types/domain";

const OGGI = "2026-08-30";

function prenotazione(overrides: {
  date: string;
  partySize?: number;
  status?: ReservationStatus;
  source?: ReservationSource;
}): PublicReservation {
  return {
    id: `res-${overrides.date}-${Math.random().toString(36).slice(2, 8)}`,
    organizationId: "org", restaurantId: "rist", locationId: "sede", customerId: "cli",
    servicePeriodId: "servizio", reservationCode: "YK-TEST", source: overrides.source ?? "web",
    status: overrides.status ?? "confirmed",
    partySize: overrides.partySize ?? 2,
    reservationDate: overrides.date,
    startAt: `${overrides.date}T19:00:00.000Z`,
    endAt: `${overrides.date}T21:00:00.000Z`,
    durationMinutes: 120,
    tableIds: [],
    customer: {
      id: "cli", firstName: "Ospite", lastName: "Prova", phone: "3330000000",
      preferredLanguage: "it", marketingConsent: false, privacyConsent: true,
      customerType: "new", totalBookings: 1, noShowCount: 0,
    },
    language: "it",
    createdAt: `${overrides.date}T10:00:00.000Z`,
    updatedAt: `${overrides.date}T10:00:00.000Z`,
  } as PublicReservation;
}

describe("metriche calcolate dalle prenotazioni vere", () => {
  it("dichiara l'assenza di dati invece di mostrare zeri come fossero misure", () => {
    const s = computeAnalytics([], { today: OGGI });
    expect(s.hasData).toBe(false);
    expect(s.covers.value).toBe(0);
    // Nessun confronto possibile: `null`, non "+100%".
    expect(s.covers.changePercent).toBeNull();
  });

  it("somma i coperti solo delle prenotazioni che hanno occupato un tavolo", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-20", partySize: 4 }),
      prenotazione({ date: "2026-08-21", partySize: 2 }),
      // Le cancellate non sono coperti: contarle gonfierebbe il dato su cui si
      // decide quanto personale mettere in sala.
      prenotazione({ date: "2026-08-22", partySize: 8, status: "cancelled_by_customer" }),
      prenotazione({ date: "2026-08-23", partySize: 6, status: "cancelled_by_restaurant" }),
    ], { today: OGGI });
    expect(s.covers.value).toBe(6);
    expect(s.reservations.value).toBe(2);
    expect(s.averageParty.value).toBe(3);
  });

  it("ignora ciò che sta fuori dalla finestra dei trenta giorni", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-25", partySize: 3 }),
      prenotazione({ date: "2026-01-10", partySize: 100 }),
    ], { today: OGGI });
    expect(s.covers.value).toBe(3);
  });

  it("confronta col periodo precedente, non con un numero inventato", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-25", partySize: 10 }),
      // 40 giorni prima: cade nella finestra precedente.
      prenotazione({ date: "2026-07-25", partySize: 5 }),
    ], { today: OGGI });
    expect(s.covers.value).toBe(10);
    expect(s.covers.previous).toBe(5);
    expect(s.covers.changePercent).toBe(100);
  });

  it("calcola il no-show sulle prenotazioni valide, non sul totale", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-20", status: "no_show" }),
      prenotazione({ date: "2026-08-21", status: "completed" }),
      prenotazione({ date: "2026-08-22", status: "completed" }),
      prenotazione({ date: "2026-08-23", status: "completed" }),
      // La cancellata non entra nel denominatore: chi annulla non è un assente.
      prenotazione({ date: "2026-08-24", status: "cancelled_by_customer" }),
    ], { today: OGGI });
    expect(s.noShowPercent.value).toBe(25);
  });

  it("divide i canali in web, telefono e altro", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-24", source: "web" }),
      prenotazione({ date: "2026-08-24", source: "phone_ai" }),
      prenotazione({ date: "2026-08-24", source: "phone_staff" }),
      prenotazione({ date: "2026-08-24", source: "walk_in" }),
    ], { today: OGGI });
    const lunedi = s.byWeekday.find((g) => g.day === "Lun")!;
    expect(lunedi).toMatchObject({ web: 1, telefono: 2, altro: 1 });
  });

  it("mette la settimana in ordine di lavoro, da lunedì a domenica", () => {
    const s = computeAnalytics([], { today: OGGI });
    expect(s.byWeekday.map((g) => g.day)).toEqual(["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]);
  });

  it("dà le quote per canale sommando a cento", () => {
    const s = computeAnalytics([
      prenotazione({ date: "2026-08-24", source: "web" }),
      prenotazione({ date: "2026-08-24", source: "web" }),
      prenotazione({ date: "2026-08-24", source: "phone_ai" }),
      prenotazione({ date: "2026-08-24", source: "admin" }),
    ], { today: OGGI });
    expect(s.bySource[0]).toMatchObject({ source: "web", count: 2, share: 50 });
    expect(s.bySource.reduce((t, v) => t + v.share, 0)).toBe(100);
  });

  it("non inventa metriche che i dati non contengono", () => {
    const s = computeAnalytics([prenotazione({ date: "2026-08-24" })], { today: OGGI });
    // Occupazione e "conversione AI" sono state rimosse di proposito: la prima
    // richiede la capienza per servizio, la seconda l'esito delle chiamate.
    expect(Object.keys(s)).not.toContain("occupancy");
    expect(Object.keys(s)).not.toContain("aiConversion");
  });
});
