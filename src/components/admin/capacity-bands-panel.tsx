"use client";

import { useState } from "react";
import { Gauge, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { CapacityBand } from "@/types/domain";

type Draft = { startTime: string; endTime: string; maxArrivals: number };

function emptyDraft(): Draft {
  return { startTime: "19:00", endTime: "19:30", maxArrivals: 10 };
}

/**
 * Limiti di arrivi per fascia oraria, oltre a quelli dei tavoli fisici.
 *
 * Il motore di disponibilità già rifiuta un orario senza tavoli liberi: questo
 * pannello serve per il caso diverso, in cui i tavoli ci sarebbero ma il
 * ristorante vuole comunque diradare gli arrivi — per non intasare la cucina
 * alle 20:00 anche se in sala ci sarebbe posto. Vale ogni giorno della
 * settimana; una fascia che non copre un orario lascia decidere solo ai tavoli.
 */
export function CapacityBandsPanel({ initialBands }: { initialBands: CapacityBand[] }) {
  const [bands, setBands] = useState(initialBands);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    const response = await fetch("/api/admin/v1/capacity-bands", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Operazione non riuscita.");
    return payload.data;
  }

  async function create(values: Draft) {
    setError(null);
    setBusy("new");
    try {
      const created = await send("POST", values) as CapacityBand;
      setBands((current) => [...current, created].sort((left, right) => left.startTime.localeCompare(right.startTime)));
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusy(null); }
  }

  async function toggle(band: CapacityBand) {
    setError(null);
    setBusy(band.id);
    try {
      const updated = await send("PATCH", { id: band.id, isActive: !band.isActive }) as CapacityBand;
      setBands((current) => current.map((row) => row.id === band.id ? updated : row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusy(null); }
  }

  async function remove(band: CapacityBand) {
    setError(null);
    setBusy(band.id);
    try {
      await send("DELETE", { id: band.id });
      setBands((current) => current.filter((row) => row.id !== band.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusy(null); }
  }

  const canSave = Boolean(draft && draft.endTime > draft.startTime && draft.maxArrivals >= 1);

  return <Card className="surface-3d-dark overflow-hidden">
    <CardHeader className="flex-row items-start justify-between gap-3 border-b">
      <div>
        <CardTitle className="font-heading text-2xl">Limiti per fascia oraria</CardTitle>
        <CardDescription>Quanti tavoli possono arrivare in ciascuna fascia, oltre alla capienza fisica della sala. Vale ogni giorno della settimana.</CardDescription>
      </div>
      <Button size="sm" variant={draft ? "secondary" : "default"} onClick={() => setDraft(draft ? null : emptyDraft())}>
        {draft ? <><X className="size-4" />Annulla</> : <><Plus className="size-4" />Aggiungi fascia</>}
      </Button>
    </CardHeader>
    <CardContent className="space-y-4 p-5 sm:p-6">
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {draft && <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/[0.045] p-4 sm:grid-cols-[1fr_auto_1fr_1fr]">
        <div><Label htmlFor="band-start">Dalle</Label><Input id="band-start" type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} className="mt-2" /></div>
        <span className="hidden self-end pb-2.5 text-xs text-muted-foreground sm:block">–</span>
        <div><Label htmlFor="band-end">Alle</Label><Input id="band-end" type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} className="mt-2" /></div>
        <div><Label htmlFor="band-max">Massimo tavoli</Label><Input id="band-max" type="number" min={1} max={200} value={draft.maxArrivals} onChange={(event) => setDraft({ ...draft, maxArrivals: Math.max(1, Number(event.target.value)) })} className="mt-2" /></div>
        <div className="sm:col-span-4">
          <Button onClick={() => void create(draft)} disabled={!canSave || busy === "new"} className="min-h-11 w-full sm:w-auto">
            {busy === "new" ? <LoaderCircle className="animate-spin" /> : <Gauge className="size-4" />}Aggiungi limite
          </Button>
        </div>
      </div>}

      {bands.length === 0
        ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun limite impostato. La disponibilità dipende solo dai tavoli fisici.</p>
        : <ul className="divide-y overflow-hidden rounded-xl border">
            {bands.map((band) => <li key={band.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", busy === band.id && "opacity-60")}>
              <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background", band.isActive ? "text-primary" : "text-muted-foreground")}><Gauge className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{band.startTime}–{band.endTime}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Massimo {band.maxArrivals} tavoli in arrivo{!band.isActive ? " · sospeso" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={band.isActive} onCheckedChange={() => void toggle(band)} disabled={busy === band.id} aria-label={band.isActive ? "Sospendi il limite" : "Riattiva il limite"} />
                <Button size="icon" variant="ghost" className="min-h-11 min-w-11" onClick={() => void remove(band)} disabled={busy === band.id} aria-label={`Elimina il limite ${band.startTime}–${band.endTime}`}>
                  {busy === band.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                </Button>
              </div>
            </li>)}
          </ul>}
    </CardContent>
  </Card>;
}
