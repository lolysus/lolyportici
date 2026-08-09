"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { it } from "date-fns/locale";
import {
  Accessibility,
  AudioWaveform,
  CalendarCheck2,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleEllipsis,
  Clock3,
  Filter,
  Hash,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Phone,
  Search,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
import { ReservationSourceBadge, reservationSourceInfo } from "@/components/reservations/reservation-source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { dateKeyInZone, formatTimeInZone } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { addDaysToDateKey, buildReservationLanes, buildServiceTimeSlots, dateFromKey, dateKeyFromDate, serviceForDate, slotSpan, slotStartIndex } from "@/lib/service-calendar";
import type { PublicReservation } from "@/repositories/repository";
import type { ReservationSource, ReservationStatus, ServicePeriod, SpecialClosure, TableResource } from "@/types/domain";

const statusCopy: Record<string, string> = {
  draft: "Bozza",
  held: "Opzione attiva",
  pending_confirmation: "In attesa di conferma",
  pending_approval: "Da approvare",
  confirmed: "Confermata",
  modified: "Modificata",
  arriving: "In arrivo",
  late: "In ritardo",
  arrived: "Arrivato",
  seated: "In servizio",
  completed: "Completata",
  cancelled_by_customer: "Cancellata",
  cancelled_by_restaurant: "Cancellata dallo staff",
  no_show: "Assente (no-show)",
  waitlisted: "In lista d'attesa",
  offered: "Proposta inviata",
  expired: "Scaduta",
};

const capacityBlockingStatuses = new Set<ReservationStatus>(["confirmed", "modified", "arriving", "late", "arrived", "seated"]);

function nextStatus(status: ReservationStatus): ReservationStatus | null {
  if (status === "pending_approval") return "confirmed";
  if (["confirmed", "modified", "arriving", "late"].includes(status)) return "arrived";
  if (status === "arrived") return "seated";
  if (status === "seated") return "completed";
  return null;
}

function nextActionLabel(currentStatus: ReservationStatus, next: ReservationStatus) {
  if (currentStatus === "pending_approval" && next === "confirmed") return "Approva";
  if (next === "arrived") return "Segna arrivato";
  if (next === "seated") return "Avvia servizio";
  return "Completa";
}

function ReservationActions({ reservation, mutate, openDetails }: { reservation: PublicReservation; mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>; openDetails: (id: string) => void }) {
  const next = nextStatus(reservation.status);
  return <div className="flex justify-end gap-2">
    {next && <Button size="sm" variant="outline" onClick={() => void mutate(reservation.id, { status: next })}>
      {next === "arrived" ? <UserRoundCheck /> : <Check />}{nextActionLabel(reservation.status, next)}
    </Button>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /><span className="sr-only">Altre azioni</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Azioni rapide</DropdownMenuLabel>
        <DropdownMenuItem asChild><a href={`tel:${reservation.customer.phone}`}><Phone />Chiama</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={`sms:${reservation.customer.phone}`}><MessageSquareText />Invia messaggio</a></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openDetails(reservation.id)}><CircleEllipsis />Apri dettaglio</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

export function ReservationsAgenda({ initialReservations, servicePeriods, closures, tables, initialDate, initialSelectedId }: { initialReservations: PublicReservation[]; servicePeriods: ServicePeriod[]; closures: SpecialClosure[]; tables: TableResource[]; initialDate: string; initialSelectedId?: string }) {
  const [rows, setRows] = useState(initialReservations);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const dayReservations = useMemo(() => rows.filter((row) => row.reservationDate === selectedDate), [rows, selectedDate]);
  const dayServices = useMemo(() => serviceForDate(servicePeriods, selectedDate), [selectedDate, servicePeriods]);
  const dayClosures = useMemo(() => closures.filter((closure) => closure.date === selectedDate), [closures, selectedDate]);

  function syncLocation(date: string, reservationId?: string | null) {
    const params = new URLSearchParams({ date });
    if (reservationId) params.set("reservation", reservationId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function changeDate(date: string) { setSelectedDate(date); setSelectedId(null); syncLocation(date); }
  function openDetails(id: string) { setSelectedId(id); syncLocation(selectedDate, id); }
  function closeDetails() { setSelectedId(null); syncLocation(selectedDate); }

  async function mutate(id: string, changes: { status?: ReservationStatus; customerNotes?: string }) {
    setError(null);
    const response = await fetch("/api/admin/v1/reservations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, ...changes }) });
    const payload = (await response.json()) as { data?: PublicReservation; error?: { message: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Aggiornamento non riuscito."); return false; }
    setRows((current) => current.map((row) => row.id === id ? payload.data! : row));
    return true;
  }

  // Il tavolo è ciò che lo staff ha davanti agli occhi in sala: cercare "12"
  // deve trovare chi siede al tavolo 12, non solo chi ha 12 nel telefono.
  const tableNames = useMemo(() => new Map(tables.map((table) => [table.id, `${table.displayName} ${table.code}`.trim()])), [tables]);
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return rows.filter((row) => {
      if (row.reservationDate !== selectedDate) return false;
      if (status === "active" && ["completed", "cancelled_by_customer", "cancelled_by_restaurant", "no_show"].includes(row.status)) return false;
      if (status === "cancelled" && !row.status.startsWith("cancelled")) return false;
      if (!["all", "active", "cancelled"].includes(status) && row.status !== status) return false;
      if (source !== "all" && row.source !== source) return false;
      if (!needle) return true;
      return [row.customer.firstName, row.customer.lastName, row.customer.phone, row.customer.email ?? "", row.reservationCode, reservationSourceInfo[row.source].label, row.id, ...row.tableIds.map((id) => tableNames.get(id) ?? "")].join(" ").toLocaleLowerCase("it").includes(needle);
    });
  }, [query, rows, selectedDate, source, status, tableNames]);

  const activeCovers = dayReservations.filter((row) => capacityBlockingStatuses.has(row.status)).reduce((total, row) => total + row.partySize, 0);
  const pendingApprovals = dayReservations.filter((row) => row.status === "pending_approval").length;
  const wholeVenueClosure = dayClosures.find((closure) => closure.type !== "opening" && !closure.affectedAreaId && !closure.affectedTableId && !closure.startTime && !closure.endTime);

  return <>
    <ServiceDayNavigator selectedDate={selectedDate} onChange={changeDate} totalReservations={dayReservations.length} activeCovers={activeCovers} pendingApprovals={pendingApprovals} serviceCount={dayServices.length} />
    <section className="surface-3d-dark mb-5 grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px_auto]" aria-label="Filtri prenotazioni">
      <div className="relative min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, telefono, codice, tavolo…" className="border-0 bg-background pl-9" /></div>
      <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-full bg-background"><Filter /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Da gestire</SelectItem><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="pending_approval">Da approvare</SelectItem><SelectItem value="confirmed">Confermate</SelectItem><SelectItem value="arriving">In arrivo</SelectItem><SelectItem value="late">In ritardo</SelectItem><SelectItem value="arrived">Arrivati</SelectItem><SelectItem value="seated">In servizio</SelectItem><SelectItem value="completed">Completate</SelectItem><SelectItem value="cancelled">Cancellate</SelectItem><SelectItem value="no_show">No-show</SelectItem></SelectContent></Select>
      <Select value={source} onValueChange={setSource}><SelectTrigger className="w-full bg-background"><SelectValue placeholder="Tutti i canali" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i canali</SelectItem>{(Object.entries(reservationSourceInfo) as Array<[ReservationSource, (typeof reservationSourceInfo)[ReservationSource]]>).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}</SelectContent></Select>
      <Badge variant="outline" className="h-9 justify-center px-3">{filteredRows.length} nel giorno</Badge>
    </section>

    {dayClosures.length > 0 && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm"><CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-amber-500" /><div><p className="font-semibold">Regola di calendario applicata</p><p className="mt-1 text-muted-foreground">{dayClosures.map((closure) => closure.reason).join(" · ")}</p></div></div>}
    {error && <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

    <Tabs defaultValue="agenda">
      <TabsList><TabsTrigger value="agenda">Sequenza arrivi</TabsTrigger><TabsTrigger value="list">Lista prenotazioni</TabsTrigger></TabsList>
      <TabsContent value="agenda" className="mt-5"><ServiceAgenda reservations={filteredRows} allReservations={dayReservations} services={dayServices} isClosed={Boolean(wholeVenueClosure)} closureReason={wholeVenueClosure?.reason} openDetails={openDetails} /></TabsContent>
      <TabsContent value="list" className="mt-5"><ReservationList reservations={filteredRows} mutate={mutate} openDetails={openDetails} /></TabsContent>
    </Tabs>
    {selected && <ReservationDetailDialog key={selected.id} reservation={selected} mutate={mutate} close={closeDetails} />}
  </>;
}

function ReservationList({ reservations, mutate, openDetails }: { reservations: PublicReservation[]; mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>; openDetails: (id: string) => void }) {
  return <>
    <div className="grid gap-3 md:hidden">{reservations.map((reservation) => <MobileReservationCard key={reservation.id} reservation={reservation} mutate={mutate} openDetails={openDetails} />)}{reservations.length === 0 && <EmptyReservations />}</div>
    <div className="surface-3d-dark hidden overflow-x-auto rounded-xl border bg-card md:block"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Orario</TableHead><TableHead>Ospite</TableHead><TableHead>Persone</TableHead><TableHead>Canale</TableHead><TableHead>Stato</TableHead><TableHead /></TableRow></TableHeader><TableBody>
      {reservations.map((reservation) => <TableRow key={reservation.id}><TableCell><p className="font-mono font-semibold">{formatTimeInZone(reservation.startAt)}</p><p className="mt-1 text-[11px] text-muted-foreground">{reservation.durationMinutes} min</p></TableCell><TableCell><div className="flex items-center gap-2"><p className="font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</p>{reservation.customer.customerType === "vip" && <Badge variant="outline" className="text-[9px]">VIP</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{reservation.customer.phone}</p></TableCell><TableCell className="font-mono">{reservation.partySize}</TableCell><TableCell><ReservationSourceBadge source={reservation.source} /></TableCell><TableCell><StatusBadge status={reservation.status} /></TableCell><TableCell><ReservationActions reservation={reservation} mutate={mutate} openDetails={openDetails} /></TableCell></TableRow>)}
      {reservations.length === 0 && <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Nessuna prenotazione con questi filtri.</TableCell></TableRow>}
    </TableBody></Table></div>
  </>;
}

function EmptyReservations() { return <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nessuna prenotazione con questi filtri.</div>; }

function MobileReservationCard({ reservation, mutate, openDetails }: { reservation: PublicReservation; mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>; openDetails: (id: string) => void }) {
  return <article className="surface-3d-dark rounded-2xl border bg-card p-4"><button type="button" onClick={() => openDetails(reservation.id)} className="w-full text-left" aria-label={`Apri dettaglio di ${reservation.customer.firstName} ${reservation.customer.lastName}`}><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-lg font-semibold">{formatTimeInZone(reservation.startAt)}</p><p className="mt-1 text-sm font-semibold">{reservation.customer.firstName} {reservation.customer.lastName}</p></div><StatusBadge status={reservation.status} /></div><div className="mt-4 flex flex-wrap items-center gap-2"><ReservationSourceBadge source={reservation.source} /><span className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">{reservation.partySize} ospiti</span></div><p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{reservation.reservationCode}</p></button><div className="mt-3 border-t pt-3"><ReservationActions reservation={reservation} mutate={mutate} openDetails={openDetails} /></div></article>;
}

function ServiceDayNavigator({ selectedDate, onChange, totalReservations, activeCovers, pendingApprovals, serviceCount }: { selectedDate: string; onChange: (date: string) => void; totalReservations: number; activeCovers: number; pendingApprovals: number; serviceCount: number }) {
  const [open, setOpen] = useState(false);
  const selected = dateFromKey(selectedDate);
  const today = dateKeyInZone(new Date());
  const label = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(selected);
  return <section className="surface-3d-dark mb-5 overflow-hidden rounded-3xl border bg-card"><div className="relative flex flex-col gap-5 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between"><div aria-hidden className="absolute -right-24 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(198,168,108,.14),transparent_68%)]" /><div className="relative flex min-w-0 items-center gap-2 sm:gap-3"><Button type="button" variant="outline" size="icon" onClick={() => onChange(addDaysToDateKey(selectedDate, -1))} aria-label="Apri il giorno precedente"><ChevronLeft /></Button><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><button type="button" className="group min-w-0 rounded-2xl px-2 py-1 text-left outline-none transition-colors hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Seleziona il giorno del servizio, attualmente ${label}`}><span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-primary"><CalendarDays className="size-3.5" />Calendario del servizio</span><span className="mt-1 block truncate font-heading text-2xl capitalize sm:text-3xl">{label}</span></button></PopoverTrigger><PopoverContent align="start" sideOffset={12} className="w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-3xl border border-foreground/10 bg-popover p-0 shadow-2xl"><div className="border-b border-foreground/10 bg-primary/8 px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Vai a una data</p><p className="mt-1 text-sm font-semibold">Controlla servizi, richieste e carico della giornata.</p></div><Calendar mode="single" selected={selected} onSelect={(next) => { if (next) { onChange(dateKeyFromDate(next)); setOpen(false); } }} locale={it} className="w-full bg-transparent p-4 [--cell-size:--spacing(10)]" classNames={{ root: "w-full", months: "w-full", month: "w-full gap-3", month_caption: "h-10 px-12 text-sm font-semibold capitalize", weekdays: "mb-1", weekday: "text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground", week: "mt-1.5", day: "rounded-xl", today: "rounded-xl bg-primary/10 text-primary" }} /><div className="border-t border-foreground/10 p-3"><Button type="button" variant="outline" className="w-full" onClick={() => { onChange(today); setOpen(false); }}>Torna a oggi</Button></div></PopoverContent></Popover><Button type="button" variant="outline" size="icon" onClick={() => onChange(addDaysToDateKey(selectedDate, 1))} aria-label="Apri il giorno successivo"><ChevronRight /></Button>{selectedDate !== today && <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => onChange(today)}>Oggi</Button>}</div><div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border text-sm sm:grid-cols-4"><CalendarMetric label="Prenotazioni" value={String(totalReservations)} /><CalendarMetric label="Coperti previsti" value={String(activeCovers)} /><CalendarMetric label="Da approvare" value={String(pendingApprovals)} tone={pendingApprovals > 0 ? "attention" : undefined} /><CalendarMetric label="Servizi attivi" value={String(serviceCount)} /></div></div></section>;
}

function CalendarMetric({ label, value, tone }: { label: string; value: string; tone?: "attention" }) { return <div className={cn("min-w-[7.5rem] bg-card px-3 py-2.5", tone === "attention" && "bg-amber-400/[0.06]")}><p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={cn("mt-1 font-mono text-lg font-semibold", tone === "attention" && "text-amber-600")}>{value}</p></div>; }

function ServiceAgenda({ reservations, allReservations, services, isClosed, closureReason, openDetails }: { reservations: PublicReservation[]; allReservations: PublicReservation[]; services: ServicePeriod[]; isClosed: boolean; closureReason?: string; openDetails: (id: string) => void }) {
  if (isClosed) return <ClosedServiceDay reservations={reservations} reason={closureReason} openDetails={openDetails} />;
  if (services.length === 0) return <div className="surface-3d-dark rounded-3xl border border-dashed bg-card p-8 text-center"><CalendarCheck2 className="mx-auto size-7 text-primary" /><h3 className="mt-4 font-heading text-2xl">Nessun servizio configurato</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Questa data non ha un servizio attivo. Puoi modificarne orari e giorni da Impostazioni → Servizi.</p></div>;
  return <div className="space-y-5">{services.map((service) => <ServiceTimeline key={service.id} service={service} reservations={reservationsForService(reservations, service, services)} occupancyReservations={reservationsForService(allReservations, service, services)} openDetails={openDetails} />)}</div>;
}

function reservationsForService(reservations: PublicReservation[], service: ServicePeriod, services: ServicePeriod[]) { const currentServiceIds = new Set(services.map((item) => item.id)); return reservations.filter((reservation) => currentServiceIds.has(reservation.servicePeriodId) ? reservation.servicePeriodId === service.id : isDuringService(reservation, service)); }
function isDuringService(reservation: PublicReservation, service: ServicePeriod) { const time = formatTimeInZone(reservation.startAt); return time >= service.startTime && time < service.endTime; }

function ClosedServiceDay({ reservations, reason, openDetails }: { reservations: PublicReservation[]; reason?: string; openDetails: (id: string) => void }) {
  return <section className="surface-3d-dark overflow-hidden rounded-3xl border border-amber-400/25 bg-card"><header className="border-b border-amber-400/20 bg-amber-400/[0.07] px-5 py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700">Calendario sospeso</p><h3 className="mt-1 font-heading text-2xl">Servizio chiuso</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{reason ?? "Una chiusura totale blocca nuove richieste in questa giornata."} Le prenotazioni già registrate restano disponibili per essere contattate o gestite.</p></div><Badge variant="outline" className="w-fit border-amber-400/35 bg-amber-400/10 text-amber-700">{reservations.length} da verificare</Badge></div></header><div className="grid gap-2 p-3">{reservations.map((reservation) => <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-background/70 p-4 text-left transition-colors hover:border-primary/40"><span className="font-mono text-base font-semibold">{formatTimeInZone(reservation.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti · {reservationSourceInfo[reservation.source].label}</span></span><StatusBadge status={reservation.status} /></button>)}{reservations.length === 0 && <div className="p-7 text-center text-sm text-muted-foreground">Nessuna prenotazione attiva da gestire durante questa chiusura.</div>}</div></section>;
}

function ServiceTimeline({ service, reservations, occupancyReservations, openDetails }: { service: ServicePeriod; reservations: PublicReservation[]; occupancyReservations: PublicReservation[]; openDetails: (id: string) => void }) {
  const slots = buildServiceTimeSlots(service);
  const lanes = useMemo(() => buildReservationLanes([...reservations].sort((left, right) => left.startAt.localeCompare(right.startAt))), [reservations]);
  const covers = occupancyReservations.filter((reservation) => capacityBlockingStatuses.has(reservation.status)).reduce((total, reservation) => total + reservation.partySize, 0);
  return <section className="surface-3d-dark overflow-hidden rounded-3xl border bg-card"><header className="flex flex-col gap-4 border-b border-foreground/10 bg-[linear-gradient(110deg,rgba(198,168,108,.11),transparent_44%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Servizio configurato</p><h3 className="mt-1 font-heading text-2xl">{service.name}</h3><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{service.startTime}–{service.endTime} · arrivi ogni {service.slotIntervalMinutes} minuti</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{reservations.length} visualizzate</Badge><Badge variant="outline">{covers} coperti previsti</Badge><Badge variant="outline">max {service.maximumArrivalsPerSlot} arrivi/slot</Badge></div></header><div className="grid gap-2 p-3 md:hidden" aria-label={`Prenotazioni ${service.name}`}>{reservations.map((reservation) => <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} className="flex items-center gap-4 rounded-2xl border bg-background/70 p-4 text-left"><span className="font-mono text-base font-semibold">{formatTimeInZone(reservation.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti · {reservationSourceInfo[reservation.source].label}</span></span><StatusBadge status={reservation.status} /></button>)}{reservations.length === 0 && <EmptyServiceTimeline />}</div><div className="hidden overflow-x-auto md:block" aria-label={`Sequenza arrivi ${service.name}`}><div className="min-w-[760px]"><div className="grid border-b border-foreground/10 bg-muted/20" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(74px, 1fr))` }}>{slots.map((time) => <span key={time} className="border-l border-foreground/8 px-2 py-3 text-center font-mono text-[10px] text-muted-foreground">{time}</span>)}</div><div className="divide-y divide-foreground/8">{lanes.map((lane, index) => <ServiceLane key={index} reservations={lane} service={service} slots={slots} openDetails={openDetails} />)}{lanes.length === 0 && <EmptyServiceTimeline />}</div></div></div></section>;
}

function EmptyServiceTimeline() { return <div className="flex min-h-28 items-center justify-center px-6 text-center text-sm text-muted-foreground">Nessuna prenotazione in questo servizio con i filtri attivi.</div>; }
function ServiceLane({ reservations, service, slots, openDetails }: { reservations: PublicReservation[]; service: ServicePeriod; slots: string[]; openDetails: (id: string) => void }) { const gridStyle = { gridTemplateColumns: `repeat(${slots.length}, minmax(74px, 1fr))` }; return <div className="grid min-h-[82px] items-center bg-background/20" style={gridStyle}>{slots.map((time, index) => <span key={time} className="row-start-1 h-full border-l border-foreground/7" style={{ gridColumn: index + 1 }} />)}{reservations.map((reservation) => { const start = slotStartIndex(formatTimeInZone(reservation.startAt), service); if (start >= slots.length) return null; const span = Math.min(slots.length - start, slotSpan(formatTimeInZone(reservation.startAt), formatTimeInZone(reservation.endAt), service.slotIntervalMinutes)); return <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} aria-label={`Apri dettaglio di ${reservation.customer.firstName} ${reservation.customer.lastName}`} style={{ gridColumn: `${start + 1} / span ${span}`, gridRow: 1 }} className={cn("z-10 mx-1 min-w-0 rounded-xl border px-3 py-2 text-left shadow-[0_10px_24px_-20px_rgba(0,0,0,.95)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", reservationRailTone(reservation.status))}><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="shrink-0 font-mono text-[9px] opacity-70">{formatTimeInZone(reservation.startAt)}</span></span><span className="mt-1 flex truncate font-mono text-[9px] opacity-70">{reservation.partySize} ospiti · {reservationSourceInfo[reservation.source].label}</span></button>; })}</div>; }

function reservationRailTone(status: ReservationStatus) { if (status === "late" || status === "no_show") return "border-red-400/30 bg-red-400/12 text-red-950 dark:text-red-100"; if (status === "pending_approval") return "border-amber-400/35 bg-amber-400/12 text-amber-950 dark:text-amber-100"; if (status === "arrived" || status === "seated") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-950 dark:text-emerald-100"; if (status.startsWith("cancelled")) return "border-foreground/10 bg-muted/45 text-muted-foreground opacity-70"; return "border-primary/28 bg-primary/12 text-foreground hover:bg-primary/18"; }
function StatusBadge({ status }: { status: ReservationStatus }) { return <Badge variant={status === "late" || status === "no_show" ? "destructive" : "outline"} className={status === "pending_approval" ? "border-amber-400/40 bg-amber-400/10 text-amber-700" : undefined}>{statusCopy[status] ?? status}</Badge>; }

function ReservationDetailDialog({ reservation, mutate, close }: { reservation: PublicReservation; mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>; close: () => void }) {
  const [notes, setNotes] = useState(reservation.customerNotes ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const next = nextStatus(reservation.status);
  const serviceDate = new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long" }).format(new Date(reservation.startAt));
  async function saveNotes() { setPending(true); setSaved(false); const success = await mutate(reservation.id, { customerNotes: notes }); setPending(false); setSaved(success); }
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl"><div className="border-b bg-card px-5 py-5 sm:px-6"><DialogHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Scheda prenotazione</p><DialogTitle className="font-heading text-3xl">{reservation.customer.firstName} {reservation.customer.lastName}</DialogTitle><DialogDescription className="mt-2 flex items-center gap-2"><Hash className="size-3.5" />{reservation.reservationCode}</DialogDescription></div><StatusBadge status={reservation.status} /></div></DialogHeader></div><div className="space-y-4 px-5 pb-6 sm:px-6"><ReservationSourceBadge source={reservation.source} showDescription />{reservation.source === "phone_ai" && <Button asChild variant="outline" size="sm" className="w-full"><Link href="/admin/calls"><AudioWaveform className="size-4" />Apri chiamate e trascrizioni vocali</Link></Button>}<DetailSection title="Servizio" icon={<CalendarDays />}><div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm sm:grid-cols-4"><Detail label="Data" value={serviceDate} /><Detail label="Ora" value={formatTimeInZone(reservation.startAt)} /><Detail label="Coperti" value={`${reservation.partySize}`} /><Detail label="Durata" value={`${reservation.durationMinutes} min`} /></div></DetailSection><DetailSection title="Contatto ospite" icon={<UserRound />}><div className="grid gap-3 text-sm sm:grid-cols-2"><a href={`tel:${reservation.customer.phone}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40"><Phone className="size-4 text-primary" /><span><span className="block text-xs text-muted-foreground">Telefono</span><span className="mt-0.5 block font-medium">{reservation.customer.phone}</span></span></a>{reservation.customer.email ? <a href={`mailto:${reservation.customer.email}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40"><Mail className="size-4 text-primary" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Email</span><span className="mt-0.5 block truncate font-medium">{reservation.customer.email}</span></span></a> : <div className="flex items-center gap-3 rounded-xl border p-3 text-muted-foreground"><Mail className="size-4" /><span><span className="block text-xs">Email</span><span className="mt-0.5 block text-sm">Non disponibile</span></span></div>}</div><div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm"><Detail label="Lingua" value={reservation.language.toUpperCase()} /><Detail label="Tipologia" value={reservation.customer.customerType === "vip" ? "Ospite VIP" : reservation.customer.customerType === "loyal" ? "Ospite fidelizzato" : reservation.customer.customerType === "regular" ? "Ospite abituale" : "Nuovo ospite"} /></div></DetailSection>{(reservation.customer.allergies || reservation.customer.accessibilityNeeds) && <DetailSection title="Attenzioni da condividere con il team" icon={<Accessibility />} tone="warning"><div className="grid gap-3 text-sm sm:grid-cols-2">{reservation.customer.allergies && <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-3"><p className="text-xs text-amber-700/70">Allergie o intolleranze</p><p className="mt-1 font-semibold text-amber-800">{reservation.customer.allergies}</p></div>}{reservation.customer.accessibilityNeeds && <div className="rounded-xl border border-sky-400/25 bg-sky-400/8 p-3"><p className="text-xs text-sky-700/70">Esigenze di accessibilità</p><p className="mt-1 font-semibold text-sky-800">{reservation.customer.accessibilityNeeds}</p></div>}</div></DetailSection>}<DetailSection title="Note operative" icon={<MessageSquareText />}>{reservation.specialOccasion && <p className="mb-3 rounded-xl border bg-muted/30 p-3 text-sm"><span className="text-xs text-muted-foreground">Occasione</span><br /><span className="mt-1 inline-block font-medium">{reservation.specialOccasion}</span></p>}<Label htmlFor="reservation-notes">Richieste cliente e note per il servizio</Label><Textarea id="reservation-notes" value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder="Aggiungi un'indicazione utile al team…" className="mt-2 min-h-28" /><div className="mt-3 flex flex-wrap gap-2"><Button onClick={saveNotes} disabled={pending}>{pending ? "Salvataggio…" : saved ? "Note salvate" : "Salva note"}</Button>{next && <Button variant="outline" onClick={() => void mutate(reservation.id, { status: next })}>{nextActionLabel(reservation.status, next)}</Button>}</div></DetailSection><div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><span>Creata {new Intl.DateTimeFormat("it", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.createdAt))}</span><span>Aggiornata {new Intl.DateTimeFormat("it", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.updatedAt))}</span></div></div></DialogContent></Dialog>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium capitalize">{value}</p></div>; }
function DetailSection({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone?: "warning"; children: React.ReactNode }) { return <section className={tone === "warning" ? "rounded-2xl border border-amber-400/20 bg-amber-400/[0.035] p-4" : "rounded-2xl border p-4"}><h3 className={tone === "warning" ? "mb-4 flex items-center gap-2 text-sm font-semibold text-amber-700 [&_svg]:size-4" : "mb-4 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-primary"}>{icon}{title}</h3>{children}</section>; }
