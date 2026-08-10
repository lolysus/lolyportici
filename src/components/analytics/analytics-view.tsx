"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumn, Download, Minus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { reservationSourceInfo } from "@/components/reservations/reservation-source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsSummary, MetricComparison } from "@/domains/analytics/analytics-service";
import type { RestaurantLocation } from "@/config/brand";

const COLORI = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

/**
 * Non contiene un solo numero proprio: tutto arriva da `computeAnalytics`, che
 * legge le prenotazioni vere. Prima erano letterali scritti qui — 1.284 coperti,
 * 78% di occupazione — e una pagina di analisi che si inventa i dati è peggio di
 * una pagina di analisi assente, perché qualcuno ci decide i turni.
 *
 * Mancano di proposito due metriche che c'erano: **occupazione** e **conversione
 * AI**. La prima richiede la capienza per servizio, la seconda l'esito delle
 * chiamate: nessuna delle due è ricavabile in modo onesto oggi, e stimarle
 * significherebbe tornare al punto di partenza con più passaggi.
 */
export function AnalyticsView({ location, summary }: { location: RestaurantLocation; summary: AnalyticsSummary }) {
  const periodo = `${formatGiorno(summary.from)} – ${formatGiorno(summary.to)}`;
  const mix = summary.bySource.map((voce, indice) => ({
    name: reservationSourceInfo[voce.source]?.label ?? voce.source,
    value: voce.count,
    share: voce.share,
    fill: COLORI[indice % COLORI.length],
  }));

  return <>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Ultimi 30 giorni · <span className="font-medium text-foreground">{periodo}</span> · confronto con i 30 precedenti</p>
      <Button asChild variant="outline"><Link href="/api/admin/v1/analytics/export"><Download />Esporta CSV</Link></Button>
    </div>

    {!summary.hasData
      ? <div className="surface-3d rounded-2xl border border-dashed bg-card p-8 text-center sm:p-12">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><ChartNoAxesColumn className="size-5" /></span>
          <h2 className="mt-5 font-heading text-2xl">Ancora nessuna prenotazione nel periodo</h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Le metriche di {location.shortName} compaiono qui appena arrivano prenotazioni negli ultimi 30 giorni.
            Non mostriamo numeri di esempio: sarebbero indistinguibili da quelli veri.
          </p>
        </div>
      : <>
        <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Coperti" metric={summary.covers} />
          <Metric label="Prenotazioni" metric={summary.reservations} />
          <Metric label="Ospiti per prenotazione" metric={summary.averageParty} decimali />
          <Metric label="No-show" metric={summary.noShowPercent} suffisso="%" positivoSeScende />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
          <Card>
            <CardHeader><CardTitle className="font-heading text-xl">Prenotazioni per giorno e canale</CardTitle></CardHeader>
            <CardContent>
              <div role="img" aria-label={descriviSettimana(summary)} className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byWeekday}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} />
                    <Bar dataKey="web" name="Web" stackId="a" fill="var(--chart-1)" />
                    <Bar dataKey="telefono" name="Telefono" stackId="a" fill="var(--chart-2)" />
                    <Bar dataKey="altro" name="Altro" stackId="a" fill="var(--chart-3)" radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-heading text-xl">Da dove arrivano</CardTitle></CardHeader>
            <CardContent>
              <div role="img" aria-label={mix.map((v) => `${v.name} ${v.share}%`).join(", ")} className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} strokeWidth={0}>
                      {mix.map((voce) => <Cell key={voce.name} fill={voce.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul role="list" className="grid gap-3 sm:grid-cols-2">
                {mix.map((voce) => <li key={voce.name} className="flex items-center gap-2 text-xs">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: voce.fill }} />
                  <span className="truncate">{voce.name}</span>
                  <span className="ml-auto shrink-0 font-mono">{voce.value} · {voce.share}%</span>
                </li>)}
              </ul>
            </CardContent>
          </Card>
        </div>
      </>}
  </>;
}

function Metric({ label, metric, suffisso = "", decimali = false, positivoSeScende = false }: {
  label: string;
  metric: MetricComparison;
  suffisso?: string;
  decimali?: boolean;
  positivoSeScende?: boolean;
}) {
  const valore = decimali
    ? metric.value.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    : metric.value.toLocaleString("it-IT");
  const delta = metric.changePercent;
  // Per il no-show scendere è una buona notizia: il colore deve dirlo.
  const buono = delta === null ? null : positivoSeScende ? delta <= 0 : delta >= 0;
  const Icona = delta === null ? Minus : (delta ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight;

  return <div className="bg-card p-5">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-3 text-3xl font-semibold tracking-tight">{valore}{suffisso}</p>
    <p className={buono === null ? "mt-2 flex items-center gap-1 text-xs text-muted-foreground" : buono ? "mt-2 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-300" : "mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300"}>
      <Icona className="size-3 shrink-0" />
      {delta === null
        ? "nessun confronto: periodo precedente vuoto"
        : `${delta > 0 ? "+" : ""}${delta.toLocaleString("it-IT")}% vs periodo precedente`}
    </p>
  </div>;
}

function descriviSettimana(summary: AnalyticsSummary) {
  return summary.byWeekday.map((g) => `${g.day}: ${g.web + g.telefono + g.altro}`).join(", ");
}

function formatGiorno(key: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00`));
}
