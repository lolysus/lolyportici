"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CheckCircle2, Grip, LockKeyhole, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PublicReservation } from "@/repositories/repository";
import type { TableResource } from "@/types/domain";
import { formatTimeInZone } from "@/lib/datetime";

export function FloorPlanBoard({ initialTables, initialReservations }: { initialTables: TableResource[]; initialReservations: PublicReservation[] }) {
  const [reservations, setReservations] = useState(initialReservations);
  const [area, setArea] = useState("internal");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tables = initialTables.filter((table) => area === "internal" ? !table.isOutdoor : table.isOutdoor);
  const active = reservations.filter((reservation) => !reservation.status.startsWith("cancelled") && reservation.status !== "completed");
  const reservationFor = (tableId: string) => active.find((reservation) => reservation.tableIds.includes(tableId));
  const unassigned = active.filter((reservation) => reservation.tableIds.length === 0);
  const statusCounts = { occupied: active.filter((item) => ["arrived","seated"].includes(item.status)).length, arriving: active.filter((item) => ["confirmed","modified","arriving"].includes(item.status)).length };

  async function handleDragEnd(event: DragEndEvent) {
    if (!event.over || !String(event.active.id).startsWith("reservation:") || !String(event.over.id).startsWith("table:")) return;
    const reservationId = String(event.active.id).replace("reservation:", "");
    const tableId = String(event.over.id).replace("table:", "");
    const response = await fetch("/api/admin/v1/reservations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: reservationId, tableIds: [tableId] }) });
    const payload = await response.json() as { data?: PublicReservation; error?: { message: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Tavolo non compatibile."); return; }
    setReservations((current) => current.map((row) => row.id === reservationId ? payload.data! : row)); setMessage("Assegnazione aggiornata in tempo reale."); setError(null);
  }

  return <DndContext onDragEnd={handleDragEnd}><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="overflow-hidden rounded-xl border bg-card"><div className="flex flex-col justify-between gap-3 border-b p-4 sm:flex-row sm:items-center"><div className="flex items-center gap-3"><Tabs value={area} onValueChange={setArea}><TabsList><TabsTrigger value="internal">Sala interna</TabsTrigger><TabsTrigger value="terrace">Terrazza</TabsTrigger></TabsList></Tabs><Badge variant="outline">{tables.length} tavoli</Badge></div><Badge variant="secondary">Trascina le prenotazioni sui tavoli</Badge></div>
      {(message || error) && <p role={error ? "alert" : "status"} className={cn("mx-4 mt-4 rounded-lg p-3 text-sm", error ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-300")}>{error ?? message}</p>}
      <div className="relative m-4 min-h-[560px] overflow-hidden rounded-xl border border-white/8 bg-[radial-gradient(circle_at_center,rgba(255,255,255,.025)_1px,transparent_1px)] bg-[length:22px_22px] sm:m-6">
        <div className="absolute left-0 top-0 h-full w-2 border-r border-dashed border-white/10 bg-white/[.02]" /><div className="absolute bottom-0 right-[24%] h-10 w-28 border-x border-t border-white/10 bg-card text-center text-[9px] uppercase tracking-widest text-muted-foreground">Ingresso</div>
        {tables.map((table) => <TableDrop key={table.id} table={table} reservation={reservationFor(table.id)} />)}
      </div>
      <div className="flex flex-wrap gap-4 border-t px-5 py-4 text-xs text-muted-foreground"><Legend color="bg-emerald-500" label="Libero" /><Legend color="bg-primary" label="Prenotato" /><Legend color="bg-sky-400" label="Occupato" /><Legend color="bg-amber-400" label="In ritardo" /><Legend color="bg-zinc-500" label="Bloccato" /></div>
    </div>
    <aside className="space-y-4"><div className="rounded-xl border bg-card p-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Servizio cena</p><div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border"><Metric value={statusCounts.arriving} label="In arrivo" /><Metric value={statusCounts.occupied} label="Occupati" /></div></div><div className="rounded-xl border bg-card p-5"><h2 className="font-heading text-xl">Da assegnare</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Trascina una prenotazione su un tavolo compatibile.</p><div className="mt-4 space-y-2">{unassigned.length ? unassigned.map((reservation) => <ReservationChip key={reservation.id} reservation={reservation} />) : <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground"><CheckCircle2 className="mx-auto mb-2 size-5" />Tutte assegnate</div>}</div></div><div className="rounded-xl border bg-card p-5"><h2 className="font-heading text-xl">Prossimi arrivi</h2><div className="mt-4 space-y-2">{active.slice(0,4).map((reservation) => <ReservationChip key={reservation.id} reservation={reservation} />)}</div></div></aside>
  </div></DndContext>;
}

function TableDrop({ table, reservation }: { table: TableResource; reservation?: PublicReservation }) {
  const { setNodeRef, isOver } = useDroppable({ id: `table:${table.id}`, disabled: table.status === "blocked" });
  const status = table.status === "blocked" ? "blocked" : reservation ? (["arrived","seated"].includes(reservation.status) ? "occupied" : reservation.status === "late" ? "late" : "reserved") : "available";
  return <div ref={setNodeRef} style={{ left: `${Math.min(84, table.positionX)}%`, top: `${Math.min(78, table.positionY)}%`, width: table.shape === "rectangle" ? 112 : 78, height: table.shape === "rectangle" ? 62 : 78 }} className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border text-center transition-colors", table.shape === "round" ? "rounded-full" : "rounded-xl", status === "available" && "border-emerald-500/40 bg-emerald-500/8", status === "reserved" && "border-primary/50 bg-primary/12", status === "occupied" && "border-sky-400/50 bg-sky-400/12", status === "late" && "border-amber-400/50 bg-amber-400/12", status === "blocked" && "border-zinc-500/40 bg-zinc-500/10", isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background")}>{status === "blocked" ? <LockKeyhole className="size-4" /> : <><span className="font-mono text-xs font-semibold">{table.code}</span>{reservation ? <span className="mt-1 max-w-[90%] truncate text-[9px]">{reservation.customer.firstName} · {reservation.partySize}p</span> : <span className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground"><UsersRound className="size-2.5" />{table.maximumCapacity}</span>}</>}</div>;
}

function ReservationChip({ reservation }: { reservation: PublicReservation }) { const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `reservation:${reservation.id}` }); return <button ref={setNodeRef} {...listeners} {...attributes} style={{ transform: transform ? `translate3d(${transform.x}px,${transform.y}px,0)` : undefined }} className={cn("flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left touch-none", isDragging && "z-50 opacity-70 shadow-xl")}><Grip className="size-3.5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{formatTimeInZone(reservation.startAt)} · {reservation.customer.firstName} {reservation.customer.lastName}</p><p className="mt-1 text-[10px] text-muted-foreground">{reservation.partySize} ospiti</p></div></button>; }
function Legend({ color, label }: { color: string; label: string }) { return <span className="flex items-center gap-2"><span className={cn("size-2 rounded-full", color)} />{label}</span>; }
function Metric({ value, label }: { value: number; label: string }) { return <div className="bg-background p-3"><p className="font-mono text-xl font-semibold">{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>; }
