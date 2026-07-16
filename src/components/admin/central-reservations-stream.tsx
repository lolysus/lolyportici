"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarCheck2, LoaderCircle } from "lucide-react";
import type { RestaurantLocation } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import type { PublicReservation } from "@/repositories/repository";

export interface CentralReservationItem {
  reservation: PublicReservation;
  location: RestaurantLocation;
}

export function CentralReservationsStream({ items, activeLocationId }: { items: CentralReservationItem[]; activeLocationId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function open(item: CentralReservationItem) {
    setPendingId(item.reservation.id);
    startTransition(async () => {
      if (item.location.id !== activeLocationId) {
        const response = await fetch("/api/admin/v1/location", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug: item.location.slug }),
        });
        if (!response.ok) {
          setPendingId(null);
          return;
        }
      }
      router.push(`/admin/reservations?date=${item.reservation.reservationDate}&reservation=${item.reservation.id}`);
      router.refresh();
    });
  }

  return <section className="surface-3d-dark mt-6 overflow-hidden rounded-2xl border bg-card" aria-labelledby="central-stream-title">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b p-5 sm:p-6">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Regia centrale</p><h2 id="central-stream-title" className="mt-2 font-heading text-2xl font-semibold tracking-tight">Ultime prenotazioni ricevute</h2><p className="mt-2 text-sm text-muted-foreground">Un flusso unico per controllare entrambi i ristoranti prima di entrare nel dettaglio operativo.</p></div>
      <span className="text-xs text-muted-foreground">{items.length} attività recenti</span>
    </div>
    <div className="divide-y">
      {items.map((item) => {
        const { reservation, location } = item;
        const pending = pendingId === reservation.id;
        return <button type="button" key={reservation.id} onClick={() => open(item)} disabled={Boolean(pendingId)} className="grid w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.025] disabled:cursor-wait disabled:opacity-70 sm:grid-cols-[44px_minmax(0,1fr)_150px_90px] sm:items-center sm:px-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}</span>
          <span className="min-w-0"><span className="block truncate font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block text-xs text-muted-foreground">{reservation.partySize} ospiti · {reservation.reservationCode}</span></span>
          <span><span className="block text-xs font-medium">{location.shortName}</span><span className="mt-1 block text-xs text-muted-foreground">{reservation.reservationDate} · {formatTimeInZone(reservation.startAt)}</span></span>
          <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">Dettaglio<ArrowUpRight className="size-3.5" /></span>
        </button>;
      })}
    </div>
  </section>;
}
