"use client";

import { useState } from "react";
import { CalendarOff, LoaderCircle, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SpecialClosure } from "@/types/domain";

type Draft = { date: string; wholeDay: boolean; startTime: string; endTime: string; type: SpecialClosure["type"]; reason: string };

const typeLabels: Record<string, string> = {
  full_closure: "Chiusura",
  partial_closure: "Chiusura parziale",
  private_event: "Evento privato",
  maintenance: "Manutenzione",
};

function emptyDraft(): Draft {
  return { date: "", wholeDay: true, startTime: "12:00", endTime: "15:00", type: "full_closure", reason: "" };
}

/**
 * Ferie, festivi ed eventi privati.
 *
 * Il motore di disponibilità le rispettava già, ma non c'era modo di
 * inserirle: per chiudere a Ferragosto bisognava disattivare il giorno
 * nell'orario settimanale e ricordarsi di riattivarlo. Qui la chiusura ha una
 * data e scade da sola.
 */
export function ClosuresPanel({ initialClosures }: { initialClosures: SpecialClosure[] }) {
  const [closures, setClosures] = useState(initialClosures);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(method: "POST" | "DELETE", body: unknown) {
    const response = await fetch("/api/admin/v1/closures", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Operazione non riuscita.");
    return payload.data;
  }

  async function create(values: Draft) {
    setError(null);
    setBusy("new");
    try {
      const created = await send("POST", {
        date: values.date,
        type: values.type,
        reason: values.reason.trim(),
        ...(values.wholeDay ? {} : { startTime: values.startTime, endTime: values.endTime }),
      }) as SpecialClosure;
      setClosures((current) => [...current, created].sort((left, right) => left.date.localeCompare(right.date)));
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusy(null); }
  }

  async function remove(closure: SpecialClosure) {
    setError(null);
    setBusy(closure.id);
    try {
      await send("DELETE", { id: closure.id });
      setClosures((current) => current.filter((row) => row.id !== closure.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusy(null); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const canSave = Boolean(draft?.date && draft.reason.trim().length >= 2 && (draft.wholeDay || draft.endTime > draft.startTime));

  return <Card className="surface-3d-dark overflow-hidden">
    <CardHeader className="flex-row items-start justify-between gap-3 border-b">
      <div>
        <CardTitle className="font-heading text-2xl">Chiusure straordinarie</CardTitle>
        <CardDescription>Ferie, festivi ed eventi privati. In queste date il sito non propone orari e nessuno può prenotare, senza toccare gli orari di apertura.</CardDescription>
      </div>
      <Button size="sm" variant={draft ? "secondary" : "default"} onClick={() => setDraft(draft ? null : emptyDraft())}>
        {draft ? <><X className="size-4" />Annulla</> : <><Plus className="size-4" />Aggiungi</>}
      </Button>
    </CardHeader>
    <CardContent className="space-y-4 p-5 sm:p-6">
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {draft && <div className="grid gap-4 rounded-xl border border-primary/20 bg-primary/[0.045] p-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="closure-date">Data</Label>
          <Input id="closure-date" type="date" min={today} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="mt-2" />
        </div>
        <div>
          <Label htmlFor="closure-type">Motivo</Label>
          <Select value={draft.type} onValueChange={(value) => setDraft({ ...draft, type: value as SpecialClosure["type"] })}>
            <SelectTrigger id="closure-type" className="mt-2 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{["full_closure", "private_event", "maintenance"].map((value) => <SelectItem key={value} value={value}>{typeLabels[value]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="closure-reason">Nota per lo staff</Label>
          <Input id="closure-reason" value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Es. Ferragosto, chiusura annuale" className="mt-2" />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch id="closure-whole-day" checked={draft.wholeDay} onCheckedChange={(value) => setDraft({ ...draft, wholeDay: value })} />
          <Label htmlFor="closure-whole-day" className="font-normal">Tutto il giorno</Label>
        </div>
        {!draft.wholeDay && <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:col-span-2">
          <div><Label htmlFor="closure-start">Dalle</Label><Input id="closure-start" type="time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} className="mt-2" /></div>
          <span className="pb-2.5 text-xs text-muted-foreground">–</span>
          <div><Label htmlFor="closure-end">Alle</Label><Input id="closure-end" type="time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} className="mt-2" /></div>
        </div>}
        <div className="sm:col-span-2">
          <Button onClick={() => void create(draft)} disabled={!canSave || busy === "new"} className="min-h-11 w-full sm:w-auto">
            {busy === "new" ? <LoaderCircle className="animate-spin" /> : <CalendarOff className="size-4" />}Chiudi questa data
          </Button>
        </div>
      </div>}

      {closures.length === 0
        ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nessuna chiusura in programma. Il ristorante segue gli orari di apertura tutti i giorni.</p>
        : <ul className="divide-y overflow-hidden rounded-xl border">
            {closures.map((closure) => <li key={closure.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", busy === closure.id && "opacity-60")}>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background text-primary"><CalendarOff className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{formatClosureDate(closure.date)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {typeLabels[closure.type] ?? closure.type}
                  {closure.startTime && closure.endTime ? ` · ${closure.startTime}–${closure.endTime}` : " · tutto il giorno"}
                  {closure.reason ? ` · ${closure.reason}` : ""}
                </p>
              </div>
              <Button size="icon" variant="ghost" className="min-h-11 min-w-11" onClick={() => void remove(closure)} disabled={busy === closure.id} aria-label={`Elimina la chiusura del ${closure.date}`}>
                {busy === closure.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
              </Button>
            </li>)}
          </ul>}
    </CardContent>
  </Card>;
}

function formatClosureDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(parsed);
}
