import Link from "next/link";
import { AlertTriangle, ArrowUpRight, AudioWaveform, CalendarCheck2, CheckCircle2, Clock3, PhoneCall, Sparkles, UsersRound } from "lucide-react";
import { CoversChart } from "@/components/analytics/covers-chart";
import { ReservationSourceBadge } from "@/components/reservations/reservation-source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RestaurantLocation } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import type { PublicReservation } from "@/repositories/repository";
import type { VoiceCall, WaitlistEntry } from "@/types/domain";
import type { RestaurantSettings, ServiceMode } from "@/types/settings";

const statusCopy: Record<string, string> = { confirmed: "Confermata", arriving: "In arrivo", arrived: "Arrivato", seated: "In servizio", late: "In ritardo", modified: "Modificata", completed: "Completata" };
const operationalStatuses = new Set(["confirmed", "modified", "arriving", "late", "arrived", "seated"]);
const modeCopy: Record<ServiceMode, { label: string; className: string }> = {
  live: { label: "Operativa", className: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" },
  approval: { label: "Solo richieste", className: "border-amber-400/20 bg-amber-400/8 text-amber-300" },
  paused: { label: "In pausa", className: "border-rose-400/20 bg-rose-400/8 text-rose-300" },
};

export function DashboardView({ reservations, waitlist, calls, location, settings }: { reservations: PublicReservation[]; waitlist: WaitlistEntry[]; calls: VoiceCall[]; location: RestaurantLocation; settings: RestaurantSettings }) {
  const activeReservations = reservations.filter((item) => operationalStatuses.has(item.status));
  const covers = activeReservations.reduce((sum, item) => sum + item.partySize, 0);
  const capacityLimit = settings.service.maximumCovers;
  const occupancyPercent = Math.min(100, Math.round((covers / capacityLimit) * 100));
  const capacityWarning = occupancyPercent >= settings.operations.capacityWarningPercent;
  const pendingApprovals = reservations.filter((item) => item.status === "pending_approval").length;
  const arriving = reservations.filter((item) => ["confirmed", "modified", "arriving", "late"].includes(item.status)).length;
  const waiting = waitlist.filter((item) => item.status === "waiting").length;
  const offered = waitlist.filter((item) => item.status === "offered").length;
  const allergies = reservations.filter((item) => Boolean(item.customer.allergies?.trim()));
  const largeParties = activeReservations.filter((item) => item.partySize >= settings.operations.largePartyAlertSize);
  const callbacks = calls.filter((call) => call.status === "callback_requested" || call.humanEscalationRequired);
  const voiceBookings = reservations.filter((item) => item.source === "phone_ai").length;
  const callConversion = calls.length > 0 ? Math.round((calls.filter((call) => call.reservationId).length / calls.length) * 100) : 0;
  const upcoming = [...reservations].filter((item) => ["confirmed", "modified", "arriving", "late", "arrived"].includes(item.status)).sort((a, b) => a.startAt.localeCompare(b.startAt)).slice(0, 6);
  const serviceMode = modeCopy[settings.operations.serviceMode];
  // Ogni collegamento resta nel ramo di questa sede: senza il prefisso si
  // uscirebbe dal pannello del ristorante al primo clic.
  const panel = (section: string) => `/admin/${location.slug}${section}`;
  const metrics = [
    { label: "Prenotazioni", value: activeReservations.length, note: `${arriving} prossimi arrivi`, icon: CalendarCheck2, href: panel("/reservations") },
    { label: "Coperti previsti", value: covers, note: "carico del servizio", icon: UsersRound, href: panel("/analytics") },
    { label: "Da approvare", value: pendingApprovals, note: pendingApprovals ? "richiedono una risposta" : "nessuna richiesta aperta", icon: CheckCircle2, href: panel("/reservations") },
    { label: "Lista d'attesa", value: waiting, note: `${offered} proposte inviate`, icon: Clock3, href: panel("/waitlist") },
  ];
  const serviceFlow = [
    { label: "Richieste", value: pendingApprovals, icon: CalendarCheck2 },
    { label: "Confermate", value: reservations.filter((item) => ["confirmed", "modified"].includes(item.status)).length, icon: CheckCircle2 },
    { label: "In arrivo", value: reservations.filter((item) => ["arriving", "late"].includes(item.status)).length, icon: Clock3 },
    { label: "In servizio", value: reservations.filter((item) => item.status === "seated").length, icon: UsersRound },
  ];
  // I coperti per mezz'ora vengono dalle prenotazioni vere. Prima erano otto
  // valori scritti a mano (8, 20, 34, 48…): un grafico che sembrava il ritmo
  // del locale e non lo era, uguale in una serata piena e in una vuota.
  const chart = buildServiceRhythm(activeReservations, capacityLimit, location.timezone);
  const peak = chart.reduce<{ time: string; covers: number } | null>((best, point) => best && best.covers >= point.covers ? best : point, null);

  return <>
    <section className="surface-3d-dark relative mb-6 overflow-hidden rounded-2xl border border-white/8 bg-card" aria-labelledby="booking-flow-title">
      <div aria-hidden className="ambient-drift absolute -right-32 -top-40 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative border-b border-white/8 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{location.shortName} · {location.city}</p><h2 id="booking-flow-title" className="mt-1 font-heading text-xl">Dalla prenotazione al servizio</h2></div><div className="flex items-center gap-2"><Badge variant="outline" className={serviceMode.className}>{serviceMode.label}</Badge><span className="hidden items-center gap-2 text-xs text-muted-foreground sm:inline-flex"><span className="signal-pulse size-1.5 rounded-full bg-emerald-400" />Aggiornato in tempo reale</span></div></div></div>
      <div className="relative grid gap-3 border-b border-white/8 bg-background/20 px-5 py-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"><span>Carico previsto</span><span className={capacityWarning ? "font-mono text-amber-300" : "font-mono text-foreground"}>{occupancyPercent}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8"><div className={capacityWarning ? "h-full rounded-full bg-amber-300" : "h-full rounded-full bg-primary"} style={{ width: `${occupancyPercent}%` }} /></div></div><p className="text-xs text-muted-foreground">Soglia di attenzione al {settings.operations.capacityWarningPercent}%</p></div>
      <div className="relative grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-4"><div aria-hidden className="service-route absolute left-[12%] right-[12%] top-[2.15rem] hidden h-px sm:block" />{serviceFlow.map((item) => <div key={item.label} className="relative z-10 bg-card/90 px-5 py-4"><div className="flex items-center justify-between"><span className="flex size-9 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary"><item.icon className="size-4" /></span><span className="font-mono text-2xl font-semibold">{item.value}</span></div><p className="mt-3 text-xs text-muted-foreground">{item.label}</p></div>)}</div>
    </section>

    <div className="surface-3d-dark grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <Link key={metric.label} href={metric.href} className="group bg-card p-5 transition-[background-color,transform] hover:bg-muted/50"><div className="flex items-start justify-between"><metric.icon className="size-4 text-primary" /><ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" /></div><p className="mt-5 text-3xl font-semibold tracking-tight">{metric.value}</p><p className="mt-1 text-sm font-medium">{metric.label}</p><p className="mt-1 text-xs text-muted-foreground">{metric.note}</p></Link>)}</div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
      <Card className="surface-3d-dark overflow-hidden"><CardHeader className="flex-row items-center justify-between border-b"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Service pulse</p><CardTitle className="mt-2 font-heading text-2xl">Prossimi arrivi</CardTitle></div><Button asChild variant="outline" size="sm"><Link href={panel("/reservations")}>Apri agenda</Link></Button></CardHeader><CardContent className="p-0"><div className="divide-y">{upcoming.map((reservation) => <Link href={`${panel("/reservations")}?reservation=${reservation.id}`} key={reservation.id} className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-white/[0.025]"><p className="font-mono text-sm font-semibold">{formatTimeInZone(reservation.startAt)}</p><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</p>{reservation.customer.customerType === "vip" && <Sparkles className="size-3.5 text-primary" />}</div><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{reservation.partySize} ospiti</span><ReservationSourceBadge source={reservation.source} /></div></div><Badge variant={reservation.status === "late" ? "destructive" : "secondary"}>{statusCopy[reservation.status] ?? reservation.status}</Badge></Link>)}{upcoming.length === 0 && <div className="px-5 py-12 text-center text-sm text-muted-foreground">Nessun arrivo in attesa.</div>}</div></CardContent></Card>
      <div className="space-y-6"><Card className="surface-3d-dark"><CardHeader><CardTitle className="font-heading text-xl">Attenzioni operative</CardTitle></CardHeader><CardContent className="space-y-3">{capacityWarning && <AlertRow icon={<AlertTriangle />} title={`Carico al ${occupancyPercent}%`} note={`${covers} coperti previsti nel servizio`} tone="warning" />}{settings.notifications.staffAllergyAlertsEnabled && allergies.slice(0, 1).map((reservation) => <AlertRow key={reservation.id} icon={<AlertTriangle />} title={`${allergies.length} ${allergies.length === 1 ? "allergia segnalata" : "allergie segnalate"}`} note={`${reservation.customer.firstName} ${reservation.customer.lastName} · ${formatTimeInZone(reservation.startAt)}`} tone="warning" />)}{settings.notifications.staffLargePartyAlertsEnabled && largeParties.length > 0 && <AlertRow icon={<UsersRound />} title={`${largeParties.length} ${largeParties.length === 1 ? "gruppo importante" : "gruppi importanti"}`} note={`Da ${settings.operations.largePartyAlertSize} coperti in su`} />}{settings.notifications.staffWaitlistAlertsEnabled && waiting >= settings.operations.waitlistAlertCount && <AlertRow icon={<Clock3 />} title={`${waiting} richieste in lista d'attesa`} note={`Soglia operativa impostata a ${settings.operations.waitlistAlertCount}`} tone="warning" />}{callbacks.length > 0 && <AlertRow icon={<PhoneCall />} title={`${callbacks.length} ${callbacks.length === 1 ? "richiamata richiesta" : "richiamate richieste"}`} note={callbacks[0].summary || callbacks[0].outcome} />}{voiceBookings > 0 && <AlertRow icon={<AudioWaveform />} title={`${voiceBookings} prenotazioni da Voce AI`} note={`${calls.length} chiamate · ${callConversion}% conversione`} />}{!capacityWarning && (!settings.notifications.staffAllergyAlertsEnabled || allergies.length === 0) && (!settings.notifications.staffLargePartyAlertsEnabled || largeParties.length === 0) && (!settings.notifications.staffWaitlistAlertsEnabled || waiting < settings.operations.waitlistAlertCount) && callbacks.length === 0 && voiceBookings === 0 && <AlertRow icon={<CheckCircle2 />} title="Nessuna criticità aperta" note="Il servizio può procedere regolarmente" tone="success" />}</CardContent></Card><Card className="surface-3d-dark"><CardHeader><CardTitle className="font-heading text-xl">Ritmo del servizio</CardTitle></CardHeader><CardContent>{peak ? <><CoversChart data={chart} /><div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground"><span>Coperti in sala</span><span className="font-mono">Picco {peak.time} · {peak.covers} su {capacityLimit}</span></div></> : <p className="py-8 text-center text-sm text-muted-foreground">Nessuna prenotazione in programma: il grafico compare appena arriva la prima.</p>}</CardContent></Card></div>
    </div>
  </>;
}

/**
 * Coperti presenti in sala, mezz'ora per mezz'ora.
 *
 * Una prenotazione pesa su tutte le mezz'ore che occupa, non solo su quella
 * d'inizio: un tavolo da sei alle 20:00 che resta due ore è in sala anche alle
 * 21:30. Contarlo una volta sola avrebbe fatto sembrare vuoto un servizio
 * pieno.
 */
function buildServiceRhythm(reservations: PublicReservation[], capacity: number, timeZone: string) {
  const perSlot = new Map<number, number>();
  for (const reservation of reservations) {
    const start = new Date(reservation.startAt).getTime();
    const end = new Date(reservation.endAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const firstSlot = Math.floor(start / 1_800_000);
    const lastSlot = Math.ceil(end / 1_800_000) - 1;
    for (let slot = firstSlot; slot <= lastSlot; slot += 1) {
      perSlot.set(slot, (perSlot.get(slot) ?? 0) + reservation.partySize);
    }
  }
  if (perSlot.size === 0) return [];
  const slots = [...perSlot.keys()].sort((left, right) => left - right);
  // Nessun buco in mezzo: una mezz'ora senza nessuno è un'informazione, non
  // una riga da saltare.
  const points = [];
  for (let slot = slots[0]; slot <= slots[slots.length - 1]; slot += 1) {
    points.push({
      time: formatTimeInZone(new Date(slot * 1_800_000), timeZone),
      covers: perSlot.get(slot) ?? 0,
      capacity,
    });
  }
  return points;
}

function AlertRow({ icon, title, note, tone }: { icon: React.ReactNode; title: string; note: string; tone?: "warning" | "success" }) { return <div className="flex items-start gap-3 rounded-xl border p-3"><span className={tone === "warning" ? "text-amber-300 [&_svg]:size-4" : tone === "success" ? "text-emerald-300 [&_svg]:size-4" : "text-muted-foreground [&_svg]:size-4"}>{icon}</span><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p></div></div>; }
