import type { PublicReservation } from "@/repositories/repository";
import type { ReservationSource } from "@/types/domain";

/**
 * Le metriche della sede, calcolate dalle prenotazioni vere.
 *
 * Prima questa pagina era interamente inventata: 1.284 coperti, 78% di
 * occupazione, 2,8% di no-show, 64% di "conversione AI" e un grafico
 * settimanale scritto a mano, moltiplicati per 0,76 quando la sede era Portici.
 * Accanto c'era — e c'è — un export CSV che legge i dati reali: la stessa pagina
 * offriva un download veritiero di fianco a grafici falsi.
 *
 * Qui non compare nessun numero che non venga dai dati. Dove un dato non è
 * ricavabile in modo onesto — l'occupazione richiede la capienza per servizio, la
 * "conversione AI" richiede l'esito delle chiamate — la metrica **non esiste**
 * invece di essere stimata: una percentuale inventata su cui il ristoratore
 * decide quanto personale mettere in sala è peggio di una percentuale assente.
 */

/** Stati che non hanno occupato un tavolo e non contano come servizio. */
const CANCELLED = new Set(["cancelled_by_customer", "cancelled_by_restaurant", "expired"]);

export interface MetricComparison {
  value: number;
  previous: number;
  /** Variazione percentuale, `null` quando il periodo precedente era vuoto. */
  changePercent: number | null;
}

export interface WeekdayBreakdown {
  day: string;
  web: number;
  telefono: number;
  altro: number;
}

export interface SourceShare {
  source: ReservationSource;
  count: number;
  /** Quota sul totale, arrotondata all'intero. */
  share: number;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  covers: MetricComparison;
  reservations: MetricComparison;
  averageParty: MetricComparison;
  noShowPercent: MetricComparison;
  byWeekday: WeekdayBreakdown[];
  bySource: SourceShare[];
  /** Falso quando nel periodo non c'è nulla: la pagina lo dice invece di mostrare zeri. */
  hasData: boolean;
}

const GIORNI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function change(value: number, previous: number): MetricComparison {
  // Senza un periodo precedente la variazione non esiste: `null` è la risposta
  // giusta, e l'interfaccia la mostra come "nessun confronto" invece di "+100%".
  const changePercent = previous === 0 ? null : Math.round(((value - previous) / previous) * 1000) / 10;
  return { value, previous, changePercent };
}

function inPeriod(rows: PublicReservation[], from: string, to: string) {
  return rows.filter((row) => row.reservationDate >= from && row.reservationDate <= to);
}

function served(rows: PublicReservation[]) {
  return rows.filter((row) => !CANCELLED.has(row.status));
}

function coversOf(rows: PublicReservation[]) {
  return served(rows).reduce((total, row) => total + row.partySize, 0);
}

function noShareOf(rows: PublicReservation[]) {
  const valide = served(rows);
  if (valide.length === 0) return 0;
  const assenti = valide.filter((row) => row.status === "no_show").length;
  return Math.round((assenti / valide.length) * 1000) / 10;
}

function canale(source: ReservationSource): keyof Omit<WeekdayBreakdown, "day"> {
  if (source === "web") return "web";
  if (source === "phone_ai" || source === "phone_staff") return "telefono";
  return "altro";
}

/**
 * Calcola le metriche su una finestra di giorni, confrontandola con la finestra
 * immediatamente precedente della stessa durata.
 */
export function computeAnalytics(
  reservations: PublicReservation[],
  options: { today?: string; days?: number } = {},
): AnalyticsSummary {
  const days = options.days ?? 30;
  const to = options.today ?? dateKey(new Date());
  const from = shiftDays(to, -(days - 1));
  const precedenteA = shiftDays(from, -1);
  const precedenteDa = shiftDays(precedenteA, -(days - 1));

  const correnti = inPeriod(reservations, from, to);
  const precedenti = inPeriod(reservations, precedenteDa, precedenteA);
  const correntiServite = served(correnti);

  const byWeekday: WeekdayBreakdown[] = GIORNI.map((day) => ({ day, web: 0, telefono: 0, altro: 0 }));
  for (const row of correntiServite) {
    const indice = new Date(`${row.reservationDate}T12:00:00.000Z`).getUTCDay();
    byWeekday[indice][canale(row.source)] += 1;
  }
  // La settimana comincia da lunedì: domenica in fondo, come la legge chi lavora.
  const settimana = [...byWeekday.slice(1), byWeekday[0]];

  const conteggi = new Map<ReservationSource, number>();
  for (const row of correntiServite) conteggi.set(row.source, (conteggi.get(row.source) ?? 0) + 1);
  const totale = correntiServite.length;
  const bySource: SourceShare[] = [...conteggi.entries()]
    .map(([source, count]) => ({ source, count, share: totale === 0 ? 0 : Math.round((count / totale) * 100) }))
    .sort((a, b) => b.count - a.count);

  const mediaCorrente = correntiServite.length === 0 ? 0
    : Math.round((coversOf(correnti) / correntiServite.length) * 10) / 10;
  const precedentiServite = served(precedenti);
  const mediaPrecedente = precedentiServite.length === 0 ? 0
    : Math.round((coversOf(precedenti) / precedentiServite.length) * 10) / 10;

  return {
    from,
    to,
    covers: change(coversOf(correnti), coversOf(precedenti)),
    reservations: change(correntiServite.length, precedentiServite.length),
    averageParty: change(mediaCorrente, mediaPrecedente),
    noShowPercent: change(noShareOf(correnti), noShareOf(precedenti)),
    byWeekday: settimana,
    bySource,
    hasData: correntiServite.length > 0,
  };
}
