"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { it } from "date-fns/locale";
import { createColumnHelper } from "@tanstack/react-table";
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
  Utensils,
} from "lucide-react";
import { ReservationSourceBadge, reservationSourceInfo } from "@/components/reservations/reservation-source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PublicReservation } from "@/repositories/repository";
import type { ReservationSource, ReservationStatus, ServicePeriod, SpecialClosure, TableResource } from "@/types/domain";
import { dateKeyInZone, formatTimeInZone } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  addDaysToDateKey,
  buildReservationLanes,
  buildServiceTimeSlots,
  dateFromKey,
  dateKeyFromDate,
  serviceForDate,
  slotSpan,
  slotStartIndex,
} from "@/lib/service-calendar";

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
  seated: "Al tavolo",
  completed: "Completata",
  cancelled_by_customer: "Cancellata",
  cancelled_by_restaurant: "Cancellata dallo staff",
  no_show: "Assente (no-show)",
  waitlisted: "In lista d’attesa",
  offered: "Proposta inviata",
  expired: "Scaduta",
};

const columnHelper = createColumnHelper<PublicReservation>();
const reservationColumns = [
  columnHelper.accessor("startAt", { header: "Ora" }),
  columnHelper.accessor((row) => `${row.customer.firstName} ${row.customer.lastName}`, {
    id: "customer",
    header: "Ospite",
  }),
  columnHelper.accessor("partySize", { header: "Coperti" }),
  columnHelper.display({ id: "table", header: "Tavolo" }),
  columnHelper.accessor("source", { header: "Canale" }),
  columnHelper.accessor("status", { header: "Stato" }),
  columnHelper.display({ id: "actions", header: "" }),
];

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
  if (next === "seated") return "Accomoda";
  return "Completa";
}

type TableDirectory = {
  byId: ReadonlyMap<string, TableResource>;
  areaNameById: ReadonlyMap<string, string>;
};

const capacityBlockingStatuses = new Set<ReservationStatus>([
  "confirmed",
  "modified",
  "arriving",
  "late",
  "arrived",
  "seated",
]);

function tableLabelFor(reservation: PublicReservation, tableDirectory: TableDirectory) {
  if (!reservation.tableIds.length) return "Da assegnare";
  return reservation.tableIds.map((id) => tableDirectory.byId.get(id)?.code ?? `Tavolo ${id.slice(-4).toUpperCase()}`).join(" + ");
}

function areaNameFor(reservation: PublicReservation, tableDirectory: TableDirectory) {
  const assignedArea = reservation.diningAreaId ? tableDirectory.areaNameById.get(reservation.diningAreaId) : undefined;
  const tableArea = reservation.tableIds.map((id) => tableDirectory.byId.get(id)?.diningAreaName).find(Boolean);
  return assignedArea ?? tableArea ?? (reservation.tableIds.length ? "Sala da verificare" : "Da assegnare");
}

function TableLabel({ reservation, tableDirectory }: { reservation: PublicReservation; tableDirectory: TableDirectory }) {
  return (
    <div>
      <p>{tableLabelFor(reservation, tableDirectory)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {areaNameFor(reservation, tableDirectory)}
      </p>
    </div>
  );
}

function ReservationActions({
  reservation,
  mutate,
  openDetails,
}: {
  reservation: PublicReservation;
  mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>;
  openDetails: (id: string) => void;
}) {
  const next = nextStatus(reservation.status);

  return (
    <div className="flex justify-end gap-2">
      {next && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void mutate(reservation.id, { status: next })}
        >
          {next === "arrived" ? (
            <UserRoundCheck />
          ) : next === "seated" ? (
            <Utensils />
          ) : (
            <Check />
          )}
          {nextActionLabel(reservation.status, next)}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal />
            <span className="sr-only">Altre azioni</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Azioni rapide</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <a href={`tel:${reservation.customer.phone}`}><Phone /> Chiama</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={`sms:${reservation.customer.phone}`}><MessageSquareText /> Invia messaggio</a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDetails(reservation.id)}>
            <CircleEllipsis /> Apri dettaglio
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ReservationsAgenda({
  initialReservations,
  servicePeriods,
  closures,
  tables,
  initialDate,
  initialSelectedId,
}: {
  initialReservations: PublicReservation[];
  servicePeriods: ServicePeriod[];
  closures: SpecialClosure[];
  tables: TableResource[];
  initialDate: string;
  initialSelectedId?: string;
}) {
  const [rows, setRows] = useState(initialReservations);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("active");
  const [source, setSource] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const tableDirectory = useMemo<TableDirectory>(() => {
    const byId = new Map(tables.map((table) => [table.id, table]));
    const areaNameById = new Map<string, string>();
    for (const table of tables) areaNameById.set(table.diningAreaId, table.diningAreaName);
    return { byId, areaNameById };
  }, [tables]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const dayReservations = useMemo(() => rows.filter((row) => row.reservationDate === selectedDate), [rows, selectedDate]);
  const dayServices = useMemo(() => serviceForDate(servicePeriods, selectedDate), [selectedDate, servicePeriods]);
  const dayClosures = useMemo(() => closures.filter((closure) => closure.date === selectedDate), [closures, selectedDate]);

  function syncLocation(date: string, reservationId?: string | null) {
    const params = new URLSearchParams();
    params.set("date", date);
    if (reservationId) params.set("reservation", reservationId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function changeDate(date: string) {
    setSelectedDate(date);
    setSelectedId(null);
    syncLocation(date);
  }

  function openDetails(id: string) {
    setSelectedId(id);
    syncLocation(selectedDate, id);
  }

  function closeDetails() {
    setSelectedId(null);
    syncLocation(selectedDate);
  }

  async function mutate(id: string, changes: { status?: ReservationStatus; customerNotes?: string }) {
    setError(null);
    const response = await fetch("/api/admin/v1/reservations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...changes }),
    });
    const payload = (await response.json()) as {
      data?: PublicReservation;
      error?: { message: string };
    };
    if (!response.ok || !payload.data) {
      setError(payload.error?.message ?? "Aggiornamento non riuscito.");
      return false;
    }
    setRows((current) =>
      current.map((row) => (row.id === id ? payload.data! : row)),
    );
    return true;
  }

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("it");
    return rows.filter((row) => {
      if (row.reservationDate !== selectedDate) return false;
      if (status === "active" && ["completed", "cancelled_by_customer", "cancelled_by_restaurant", "no_show"].includes(row.status)) return false;
      if (status === "cancelled" && !row.status.startsWith("cancelled")) return false;
      if (!["all", "active", "cancelled"].includes(status) && row.status !== status) return false;
      if (source !== "all" && row.source !== source) return false;
      if (!needle) return true;
      return [
        row.customer.firstName,
        row.customer.lastName,
        row.customer.phone,
        row.customer.email ?? "",
        row.reservationCode,
        reservationSourceInfo[row.source].label,
        row.id,
      ]
        .join(" ")
        .toLocaleLowerCase("it")
        .includes(needle);
    });
  }, [query, rows, selectedDate, source, status]);

  const activeCovers = dayReservations
    .filter((row) => capacityBlockingStatuses.has(row.status))
    .reduce((total, row) => total + row.partySize, 0);
  const unassignedReservations = dayReservations.filter((row) => row.tableIds.length === 0 && capacityBlockingStatuses.has(row.status)).length;
  const wholeVenueClosure = dayClosures.find((closure) => closure.type !== "opening" && !closure.affectedAreaId && !closure.affectedTableId && !closure.startTime && !closure.endTime);

  return (
    <>
      <ServiceDayNavigator
        selectedDate={selectedDate}
        onChange={changeDate}
        totalReservations={dayReservations.length}
        activeCovers={activeCovers}
        unassignedReservations={unassignedReservations}
        serviceCount={dayServices.length}
      />
      <div className="surface-3d-dark mb-5 grid gap-3 rounded-2xl border bg-card p-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_190px_190px_auto]">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, telefono, codice…"
            className="border-0 bg-background pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full bg-background">
            <Filter />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Da gestire</SelectItem>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="pending_approval">Da approvare</SelectItem>
            <SelectItem value="confirmed">Confermate</SelectItem>
            <SelectItem value="arriving">In arrivo</SelectItem>
            <SelectItem value="late">In ritardo</SelectItem>
            <SelectItem value="arrived">Arrivati</SelectItem>
            <SelectItem value="seated">Al tavolo</SelectItem>
            <SelectItem value="completed">Completate</SelectItem>
            <SelectItem value="cancelled">Cancellate</SelectItem>
            <SelectItem value="no_show">No-show</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Tutti i canali" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i canali</SelectItem>
            {(Object.entries(reservationSourceInfo) as Array<[ReservationSource, (typeof reservationSourceInfo)[ReservationSource]]>).map(([value, info]) => <SelectItem key={value} value={value}>{info.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="h-9 justify-center px-3">
          {filteredRows.length} nel giorno
        </Badge>
      </div>

      {dayClosures.length > 0 && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm"><CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-amber-500" /><div><p className="font-semibold">Regola di calendario applicata</p><p className="mt-1 text-muted-foreground">{dayClosures.map((closure) => closure.reason).join(" · ")}</p></div></div>}

      {error && (
        <p role="alert" className="mb-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <Tabs defaultValue="agenda">
        <TabsList>
          <TabsTrigger value="agenda">Agenda del servizio</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
        </TabsList>
        <TabsContent value="agenda" className="mt-5">
          <ServiceAgenda reservations={filteredRows} allReservations={dayReservations} services={dayServices} tableDirectory={tableDirectory} isClosed={Boolean(wholeVenueClosure)} closureReason={wholeVenueClosure?.reason} openDetails={openDetails} />
        </TabsContent>
        <TabsContent value="list" className="mt-5">
          <div className="grid gap-3 md:hidden">
            {filteredRows.map((reservation) => <MobileReservationCard key={reservation.id} reservation={reservation} tableDirectory={tableDirectory} mutate={mutate} openDetails={openDetails} />)}
            {filteredRows.length === 0 && <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Nessuna prenotazione con questi filtri.</div>}
          </div>
          <div className="surface-3d-dark hidden overflow-x-auto rounded-xl border bg-card md:block">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  {reservationColumns.map((column, index) => (
                    <TableHead key={"id" in column && column.id ? column.id : index}>
                      {typeof column.header === "string" ? column.header : ""}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <p className="font-mono font-semibold">{formatTimeInZone(reservation.startAt)}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {reservation.durationMinutes} min
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {reservation.customer.firstName} {reservation.customer.lastName}
                        </p>
                        {reservation.customer.customerType === "vip" && (
                          <Badge variant="outline" className="text-[9px]">VIP</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{reservation.customer.phone}</p>
                    </TableCell>
                    <TableCell className="font-mono">{reservation.partySize}</TableCell>
                    <TableCell><TableLabel reservation={reservation} tableDirectory={tableDirectory} /></TableCell>
                    <TableCell>
                      <ReservationSourceBadge source={reservation.source} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={reservation.status === "late" ? "destructive" : "outline"}>
                        {statusCopy[reservation.status] ?? reservation.status}
                      </Badge>
                    </TableCell>
                    <TableCell><ReservationActions reservation={reservation} mutate={mutate} openDetails={openDetails} /></TableCell>
                  </TableRow>
                ))}
                {filteredRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={reservationColumns.length} className="h-32 text-center text-muted-foreground">
                      Nessuna prenotazione con questi filtri.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      {selected && <ReservationDetailDialog key={selected.id} reservation={selected} tableDirectory={tableDirectory} mutate={mutate} close={closeDetails} />}
    </>
  );
}

function MobileReservationCard({
  reservation,
  tableDirectory,
  mutate,
  openDetails,
}: {
  reservation: PublicReservation;
  tableDirectory: TableDirectory;
  mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>;
  openDetails: (id: string) => void;
}) {
  return <article className="surface-3d-dark rounded-2xl border bg-card p-4">
    <button type="button" onClick={() => openDetails(reservation.id)} className="w-full text-left" aria-label={`Apri dettaglio di ${reservation.customer.firstName} ${reservation.customer.lastName}`}>
      <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-lg font-semibold">{formatTimeInZone(reservation.startAt)}</p><p className="mt-1 text-sm font-semibold">{reservation.customer.firstName} {reservation.customer.lastName}</p></div><Badge variant={reservation.status === "late" ? "destructive" : "outline"}>{statusCopy[reservation.status] ?? reservation.status}</Badge></div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><ReservationSourceBadge source={reservation.source} /><span className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">{reservation.partySize} ospiti</span><span className="rounded-full border px-2.5 py-1 text-[11px] text-muted-foreground">{tableLabelFor(reservation, tableDirectory)}</span></div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{reservation.reservationCode}</p>
    </button>
    <div className="mt-3 border-t pt-3"><ReservationActions reservation={reservation} mutate={mutate} openDetails={openDetails} /></div>
  </article>;
}

function ServiceDayNavigator({
  selectedDate,
  onChange,
  totalReservations,
  activeCovers,
  unassignedReservations,
  serviceCount,
}: {
  selectedDate: string;
  onChange: (date: string) => void;
  totalReservations: number;
  activeCovers: number;
  unassignedReservations: number;
  serviceCount: number;
}) {
  const [open, setOpen] = useState(false);
  const selected = dateFromKey(selectedDate);
  const today = dateKeyInZone(new Date());
  const label = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selected);

  return (
    <section className="surface-3d-dark mb-5 overflow-hidden rounded-3xl border bg-card">
      <div className="relative flex flex-col gap-5 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 size-64 rounded-full bg-[radial-gradient(circle,rgba(198,168,108,.14),transparent_68%)]" />
        <div className="relative flex min-w-0 items-center gap-2 sm:gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => onChange(addDaysToDateKey(selectedDate, -1))} aria-label="Apri il giorno precedente"><ChevronLeft /></Button>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="group min-w-0 rounded-2xl px-2 py-1 text-left outline-none transition-colors hover:bg-background/70 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Seleziona il giorno del servizio, attualmente ${label}`}>
                <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.16em] text-primary"><CalendarDays className="size-3.5" />Calendario del servizio</span>
                <span className="mt-1 block truncate font-heading text-2xl capitalize sm:text-3xl">{label}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={12} className="w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-3xl border border-foreground/10 bg-popover p-0 shadow-2xl">
              <div className="border-b border-foreground/10 bg-primary/8 px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Vai a una data</p><p className="mt-1 text-sm font-semibold">Controlla servizi, chiusure e carico della giornata.</p></div>
              <Calendar mode="single" selected={selected} onSelect={(next) => { if (next) { onChange(dateKeyFromDate(next)); setOpen(false); } }} locale={it} className="w-full bg-transparent p-4 [--cell-size:--spacing(10)]" classNames={{ root: "w-full", months: "w-full", month: "w-full gap-3", month_caption: "h-10 px-12 text-sm font-semibold capitalize", weekdays: "mb-1", weekday: "text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground", week: "mt-1.5", day: "rounded-xl", today: "rounded-xl bg-primary/10 text-primary" }} />
              <div className="border-t border-foreground/10 p-3"><Button type="button" variant="outline" className="w-full" onClick={() => { onChange(today); setOpen(false); }}>Torna a oggi</Button></div>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" size="icon" onClick={() => onChange(addDaysToDateKey(selectedDate, 1))} aria-label="Apri il giorno successivo"><ChevronRight /></Button>
          {selectedDate !== today && <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => onChange(today)}>Oggi</Button>}
        </div>
        <div className="relative grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border text-sm sm:grid-cols-4">
          <CalendarMetric label="Prenotazioni" value={String(totalReservations)} />
          <CalendarMetric label="Coperti impegnati" value={String(activeCovers)} />
          <CalendarMetric label="Da assegnare" value={String(unassignedReservations)} tone={unassignedReservations > 0 ? "attention" : undefined} />
          <CalendarMetric label="Servizi attivi" value={String(serviceCount)} />
        </div>
      </div>
    </section>
  );
}

function CalendarMetric({ label, value, tone }: { label: string; value: string; tone?: "attention" }) {
  return <div className={cn("min-w-[7.5rem] bg-card px-3 py-2.5", tone === "attention" && "bg-amber-400/[0.06]")}><p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={cn("mt-1 font-mono text-lg font-semibold", tone === "attention" && "text-amber-600")}>{value}</p></div>;
}

function ServiceAgenda({
  reservations,
  allReservations,
  services,
  tableDirectory,
  isClosed,
  closureReason,
  openDetails,
}: {
  reservations: PublicReservation[];
  allReservations: PublicReservation[];
  services: ServicePeriod[];
  tableDirectory: TableDirectory;
  isClosed: boolean;
  closureReason?: string;
  openDetails: (id: string) => void;
}) {
  if (isClosed) return <ClosedServiceDay reservations={reservations} tableDirectory={tableDirectory} reason={closureReason} openDetails={openDetails} />;

  if (services.length === 0) {
    return <div className="surface-3d-dark rounded-3xl border border-dashed bg-card p-8 text-center"><CalendarCheck2 className="mx-auto size-7 text-primary" /><h3 className="mt-4 font-heading text-2xl">Nessun servizio configurato</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Questa data non ha un servizio attivo. Puoi modificarne orari e giorni da Impostazioni → Servizi.</p></div>;
  }

  return <div className="space-y-5">
    {services.map((service) => <ServiceRail key={service.id} service={service} reservations={reservationsForService(reservations, service, services)} occupancyReservations={reservationsForService(allReservations, service, services)} tableDirectory={tableDirectory} openDetails={openDetails} />)}
  </div>;
}

function reservationsForService(reservations: PublicReservation[], service: ServicePeriod, services: ServicePeriod[]) {
  const currentServiceIds = new Set(services.map((item) => item.id));
  return reservations.filter((reservation) => currentServiceIds.has(reservation.servicePeriodId) ? reservation.servicePeriodId === service.id : isDuringService(reservation, service));
}

function isDuringService(reservation: PublicReservation, service: ServicePeriod) {
  const time = formatTimeInZone(reservation.startAt);
  return time >= service.startTime && time < service.endTime;
}

function ClosedServiceDay({ reservations, tableDirectory, reason, openDetails }: { reservations: PublicReservation[]; tableDirectory: TableDirectory; reason?: string; openDetails: (id: string) => void }) {
  return <section className="surface-3d-dark overflow-hidden rounded-3xl border border-amber-400/25 bg-card">
    <header className="border-b border-amber-400/20 bg-amber-400/[0.07] px-5 py-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-700">Calendario sospeso</p><h3 className="mt-1 font-heading text-2xl">Servizio chiuso</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{reason ?? "Una chiusura totale blocca nuove disponibilità in questa giornata."} Le prenotazioni già registrate restano qui per essere contattate o gestite.</p></div><Badge variant="outline" className="w-fit border-amber-400/35 bg-amber-400/10 text-amber-700">{reservations.length} da verificare</Badge></div></header>
    <div className="grid gap-2 p-3">{reservations.map((reservation) => <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border bg-background/70 p-4 text-left transition-colors hover:border-primary/40"><span className="font-mono text-base font-semibold">{formatTimeInZone(reservation.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti · {areaNameFor(reservation, tableDirectory)} · {tableLabelFor(reservation, tableDirectory)}</span></span><StatusBadge status={reservation.status} /></button>)}{reservations.length === 0 && <div className="p-7 text-center text-sm text-muted-foreground">Nessuna prenotazione attiva da gestire durante questa chiusura.</div>}</div>
  </section>;
}

function ServiceRail({ service, reservations, occupancyReservations, tableDirectory, openDetails }: { service: ServicePeriod; reservations: PublicReservation[]; occupancyReservations: PublicReservation[]; tableDirectory: TableDirectory; openDetails: (id: string) => void }) {
  const slots = buildServiceTimeSlots(service);
  const areas = useMemo(() => {
    const grouped = new Map<string, PublicReservation[]>();
    for (const reservation of reservations) {
      const name = areaNameFor(reservation, tableDirectory);
      grouped.set(name, [...(grouped.get(name) ?? []), reservation]);
    }
    return [...grouped.entries()].map(([name, items]) => ({ name, items, lanes: buildReservationLanes(items) }));
  }, [reservations, tableDirectory]);
  const covers = occupancyReservations.filter((reservation) => capacityBlockingStatuses.has(reservation.status)).reduce((total, reservation) => total + reservation.partySize, 0);

  return <section className="surface-3d-dark overflow-hidden rounded-3xl border bg-card">
    <header className="flex flex-col gap-4 border-b border-foreground/10 bg-[linear-gradient(110deg,rgba(198,168,108,.11),transparent_44%)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Servizio configurato</p><h3 className="mt-1 font-heading text-2xl">{service.name}</h3><p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{service.startTime}–{service.endTime} · arrivi ogni {service.slotIntervalMinutes} minuti · riassetto {service.turnaroundMinutes} min</p></div>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">{reservations.length} visualizzate</Badge><Badge variant="outline">{occupancyReservations.length} prenotazioni</Badge><Badge variant="outline">{covers} / {service.maximumCovers} coperti impegnati</Badge><Badge variant="outline">max {service.maximumArrivalsPerSlot} arrivi/slot</Badge></div>
    </header>
    <div className="grid gap-2 p-3 md:hidden" aria-label={`Agenda ${service.name}`}>
      {reservations.map((reservation) => <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} className="flex items-center gap-4 rounded-2xl border bg-background/70 p-4 text-left"><span className="font-mono text-base font-semibold">{formatTimeInZone(reservation.startAt)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti · {areaNameFor(reservation, tableDirectory)} · {reservationSourceInfo[reservation.source].label}</span></span><StatusBadge status={reservation.status} /></button>)}
      {reservations.length === 0 && <EmptyServiceRail />}
    </div>
    <div className="hidden overflow-x-auto md:block" aria-label={`Agenda ${service.name}, scorri orizzontalmente per vedere tutti gli orari`}>
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[156px_minmax(0,1fr)] border-b border-foreground/10 bg-muted/20">
          <span className="px-5 py-3 text-[10px] font-mono uppercase tracking-[0.15em] text-muted-foreground">Sala / corsia</span>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(74px, 1fr))` }}>{slots.map((time) => <span key={time} className="border-l border-foreground/8 px-2 py-3 text-center font-mono text-[10px] text-muted-foreground">{time}</span>)}</div>
        </div>
        {areas.map((area) => <AreaRail key={area.name} name={area.name} lanes={area.lanes} service={service} slots={slots} openDetails={openDetails} />)}
        {areas.length === 0 && <EmptyServiceRail />}
      </div>
    </div>
  </section>;
}

function EmptyServiceRail() {
  return <div className="flex min-h-28 items-center justify-center px-6 text-center text-sm text-muted-foreground">Nessuna prenotazione in questo servizio con i filtri attivi.</div>;
}

function AreaRail({ name, lanes, service, slots, openDetails }: { name: string; lanes: PublicReservation[][]; service: ServicePeriod; slots: string[]; openDetails: (id: string) => void }) {
  const covers = lanes.flat().reduce((total, reservation) => total + reservation.partySize, 0);
  return <div className="grid grid-cols-[156px_minmax(0,1fr)] border-b border-foreground/10 last:border-b-0">
    <div className="flex flex-col justify-center border-r border-foreground/10 bg-muted/[0.14] px-5 py-4"><p className="font-medium">{name}</p><p className="mt-1 text-xs text-muted-foreground">{lanes.flat().length} prenotazioni · {covers} coperti</p></div>
    <div className="divide-y divide-foreground/8">{lanes.map((lane, index) => <ServiceLane key={`${name}-${index}`} reservations={lane} service={service} slots={slots} openDetails={openDetails} />)}</div>
  </div>;
}

function ServiceLane({ reservations, service, slots, openDetails }: { reservations: PublicReservation[]; service: ServicePeriod; slots: string[]; openDetails: (id: string) => void }) {
  const gridStyle = { gridTemplateColumns: `repeat(${slots.length}, minmax(74px, 1fr))` };
  return <div className="grid min-h-[82px] items-center bg-background/20" style={gridStyle}>
    {slots.map((time, index) => <span key={time} className="row-start-1 h-full border-l border-foreground/7" style={{ gridColumn: index + 1 }} />)}
    {reservations.map((reservation) => {
      const start = slotStartIndex(formatTimeInZone(reservation.startAt), service);
      if (start >= slots.length) return null;
      const span = Math.min(slots.length - start, slotSpan(formatTimeInZone(reservation.startAt), formatTimeInZone(reservation.endAt), service.slotIntervalMinutes));
      return <button key={reservation.id} type="button" onClick={() => openDetails(reservation.id)} aria-label={`Apri dettaglio di ${reservation.customer.firstName} ${reservation.customer.lastName}`} style={{ gridColumn: `${start + 1} / span ${span}`, gridRow: 1 }} className={cn("z-10 mx-1 min-w-0 rounded-xl border px-3 py-2 text-left shadow-[0_10px_24px_-20px_rgba(0,0,0,.95)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", reservationRailTone(reservation.status))}><span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="shrink-0 font-mono text-[9px] opacity-70">{formatTimeInZone(reservation.startAt)}</span></span><span className="mt-1 flex truncate font-mono text-[9px] opacity-70">{reservation.partySize} ospiti · {reservationSourceInfo[reservation.source].label}</span></button>;
    })}
  </div>;
}

function reservationRailTone(status: ReservationStatus) {
  if (status === "late" || status === "no_show") return "border-red-400/30 bg-red-400/12 text-red-950 dark:text-red-100";
  if (status === "pending_approval") return "border-amber-400/35 bg-amber-400/12 text-amber-950 dark:text-amber-100";
  if (status === "arrived" || status === "seated") return "border-emerald-400/30 bg-emerald-400/12 text-emerald-950 dark:text-emerald-100";
  if (status.startsWith("cancelled")) return "border-foreground/10 bg-muted/45 text-muted-foreground opacity-70";
  return "border-primary/28 bg-primary/12 text-foreground hover:bg-primary/18";
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  return <Badge variant={status === "late" || status === "no_show" ? "destructive" : "outline"} className={status === "pending_approval" ? "border-amber-400/40 bg-amber-400/10 text-amber-700" : undefined}>{statusCopy[status] ?? status}</Badge>;
}

function ReservationDetailDialog({
  reservation,
  tableDirectory,
  mutate,
  close,
}: {
  reservation: PublicReservation;
  tableDirectory: TableDirectory;
  mutate: (id: string, changes: { status?: ReservationStatus; customerNotes?: string }) => Promise<boolean>;
  close: () => void;
}) {
  const [notes, setNotes] = useState(reservation.customerNotes ?? "");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const next = nextStatus(reservation.status);

  async function saveNotes() {
    setPending(true); setSaved(false);
    const success = await mutate(reservation.id, { customerNotes: notes });
    setPending(false); setSaved(success);
  }

  const tableLabel = tableLabelFor(reservation, tableDirectory);
  const serviceDate = new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long" }).format(new Date(reservation.startAt));

  return <Dialog open onOpenChange={(open) => { if (!open) close(); }}><DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
    <div className="border-b bg-card px-5 py-5 sm:px-6"><DialogHeader><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Scheda prenotazione</p><DialogTitle className="font-heading text-3xl">{reservation.customer.firstName} {reservation.customer.lastName}</DialogTitle><DialogDescription className="mt-2 flex items-center gap-2"><Hash className="size-3.5" />{reservation.reservationCode}</DialogDescription></div><Badge variant={reservation.status === "late" ? "destructive" : "outline"} className="mt-1">{statusCopy[reservation.status] ?? reservation.status}</Badge></div></DialogHeader></div>

    <div className="space-y-4 px-5 pb-6 sm:px-6">
      <ReservationSourceBadge source={reservation.source} showDescription />
      {reservation.source === "phone_ai" && <Button asChild variant="outline" size="sm" className="w-full"><Link href="/admin/calls"><AudioWaveform className="size-4" />Apri chiamate e trascrizioni vocali</Link></Button>}

      <DetailSection title="Servizio" icon={<CalendarDays />}>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm sm:grid-cols-4"><Detail label="Data" value={serviceDate}/><Detail label="Ora" value={formatTimeInZone(reservation.startAt)}/><Detail label="Coperti" value={`${reservation.partySize}`}/><Detail label="Durata" value={`${reservation.durationMinutes} min`}/></div>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm"><Detail label="Sala" value={areaNameFor(reservation, tableDirectory)}/><Detail label="Tavolo" value={tableLabel}/></div>
      </DetailSection>

      <DetailSection title="Contatto ospite" icon={<UserRound />}>
        <div className="grid gap-3 text-sm sm:grid-cols-2"><a href={`tel:${reservation.customer.phone}`} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40"><Phone className="size-4 text-primary" /><span><span className="block text-xs text-muted-foreground">Telefono</span><span className="mt-0.5 block font-medium">{reservation.customer.phone}</span></span></a><a href={reservation.customer.email ? `mailto:${reservation.customer.email}` : undefined} className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40"><Mail className="size-4 text-primary" /><span className="min-w-0"><span className="block text-xs text-muted-foreground">Email</span><span className="mt-0.5 block truncate font-medium">{reservation.customer.email ?? "Non disponibile"}</span></span></a></div>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border text-sm"><Detail label="Lingua" value={reservation.language.toUpperCase()}/><Detail label="Tipologia" value={reservation.customer.customerType === "vip" ? "Ospite VIP" : reservation.customer.customerType === "loyal" ? "Ospite fidelizzato" : reservation.customer.customerType === "regular" ? "Ospite abituale" : "Nuovo ospite"}/></div>
      </DetailSection>

      {(reservation.customer.allergies || reservation.customer.accessibilityNeeds) && <DetailSection title="Attenzioni da condividere con la sala" icon={<Accessibility />} tone="warning">
        <div className="grid gap-3 text-sm sm:grid-cols-2">{reservation.customer.allergies && <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-3"><p className="text-xs text-amber-700/70">Allergie o intolleranze</p><p className="mt-1 font-semibold text-amber-800">{reservation.customer.allergies}</p></div>}{reservation.customer.accessibilityNeeds && <div className="rounded-xl border border-sky-400/25 bg-sky-400/8 p-3"><p className="text-xs text-sky-700/70">Esigenze di accessibilità</p><p className="mt-1 font-semibold text-sky-800">{reservation.customer.accessibilityNeeds}</p></div>}</div>
      </DetailSection>}

      <DetailSection title="Note operative" icon={<MessageSquareText />}>
        {reservation.specialOccasion && <p className="mb-3 rounded-xl border bg-muted/30 p-3 text-sm"><span className="text-xs text-muted-foreground">Occasione</span><br/><span className="mt-1 inline-block font-medium">{reservation.specialOccasion}</span></p>}
        <Label htmlFor="reservation-notes">Richieste cliente e note per il servizio</Label><Textarea id="reservation-notes" value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder="Aggiungi un’indicazione utile a sala o cucina…" className="mt-2 min-h-28"/><div className="mt-3 flex flex-wrap gap-2"><Button onClick={saveNotes} disabled={pending}>{pending ? "Salvataggio…" : saved ? "Note salvate" : "Salva note"}</Button>{next && <Button variant="outline" onClick={() => void mutate(reservation.id, { status: next })}>{nextActionLabel(reservation.status, next)}</Button>}</div>
      </DetailSection>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><span>Creata {new Intl.DateTimeFormat("it", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.createdAt))}</span><span>Aggiornata {new Intl.DateTimeFormat("it", { dateStyle: "short", timeStyle: "short" }).format(new Date(reservation.updatedAt))}</span></div>
    </div>
  </DialogContent></Dialog>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="bg-background p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium capitalize">{value}</p></div>;
}

function DetailSection({ title, icon, tone, children }: { title: string; icon: React.ReactNode; tone?: "warning"; children: React.ReactNode }) {
  return <section className={tone === "warning" ? "rounded-2xl border border-amber-400/20 bg-amber-400/[0.035] p-4" : "rounded-2xl border p-4"}><h3 className={tone === "warning" ? "mb-4 flex items-center gap-2 text-sm font-semibold text-amber-700 [&_svg]:size-4" : "mb-4 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-primary"}>{icon}{title}</h3>{children}</section>;
}
