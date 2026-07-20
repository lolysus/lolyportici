"use client";

import { useState } from "react";
import { Check, Clock3, LoaderCircle, MessageSquareText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTimeInZone } from "@/lib/datetime";
import type { WaitlistEntry } from "@/types/domain";

const stages: Array<{ status: WaitlistEntry["status"]; title: string; empty: string }> = [
  { status: "waiting", title: "In attesa", empty: "Nessuna richiesta da gestire" },
  { status: "offered", title: "Proposta inviata", empty: "Nessuna proposta in attesa" },
  { status: "converted", title: "Prenotazioni create", empty: "Nessuna richiesta convertita" },
];

export function WaitlistBoard({ initialEntries }: { initialEntries: WaitlistEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(id: string, status: WaitlistEntry["status"]) {
    setPending(id);
    setError(null);
    const response = await fetch("/api/admin/v1/waitlist", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const payload = await response.json() as { data?: WaitlistEntry; error?: { message: string } };
    if (payload.data) setEntries((current) => current.map((entry) => entry.id === id ? payload.data! : entry));
    else setError(payload.error?.message ?? "Aggiornamento non riuscito.");
    setPending(null);
  }

  return <div className="grid gap-5 lg:grid-cols-3">
    {stages.map((stage) => {
      const stageEntries = entries.filter((entry) => entry.status === stage.status);
      return <section key={stage.status} className="surface-3d-dark rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3.5"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary">Flusso richieste</p><h2 className="mt-1 font-heading text-lg">{stage.title}</h2></div><Badge variant="secondary">{stageEntries.length}</Badge></div>
        <div className="space-y-3 p-3">
          {stageEntries.map((entry) => <article key={entry.id} className="rounded-xl border bg-background p-4 transition-colors hover:border-primary/30"><div className="flex justify-between gap-3"><div><p className="font-medium">{entry.customer.firstName} {entry.customer.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{entry.partySize} ospiti · {formatTimeInZone(entry.requestedStartAt)} · flessibilità {entry.flexibilityMinutes} min</p></div><span className="font-mono text-xs text-muted-foreground">P{entry.priority}</span></div><div className="mt-4 flex flex-wrap gap-2">{stage.status === "waiting" && <Button size="sm" onClick={() => void update(entry.id, "offered")} disabled={pending === entry.id}>{pending === entry.id ? <LoaderCircle className="animate-spin" /> : <MessageSquareText />}Invia proposta</Button>}{stage.status === "offered" && <Button size="sm" onClick={() => void update(entry.id, "converted")} disabled={pending === entry.id}>{pending === entry.id ? <LoaderCircle className="animate-spin" /> : <Check />}Crea prenotazione</Button>}{stage.status !== "converted" && <Button size="sm" variant="ghost" onClick={() => void update(entry.id, "cancelled")}><X />Rimuovi</Button>}</div></article>)}
          {stageEntries.length === 0 && <div className="py-12 text-center text-xs text-muted-foreground"><Clock3 className="mx-auto mb-2 size-5" />{stage.empty}</div>}
        </div>
      </section>;
    })}
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive lg:col-span-3">{error}</p>}
  </div>;
}
