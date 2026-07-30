"use client";

import { useMemo, useState } from "react";
import { Armchair, Check, LoaderCircle, Pencil, Plus, Trees, Trash2, UsersRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { TableResource } from "@/types/domain";

type Draft = {
  code: string;
  displayName: string;
  minimumCapacity: number;
  maximumCapacity: number;
  isOutdoor: boolean;
  isAccessible: boolean;
};

const emptyDraft = (isOutdoor: boolean): Draft => ({
  code: "",
  displayName: "",
  minimumCapacity: 2,
  maximumCapacity: 4,
  isOutdoor,
  isAccessible: false,
});

export function TablesManager({ initialTables }: { initialTables: TableResource[] }) {
  const [tables, setTables] = useState(initialTables);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const groups = useMemo(() => ({
    indoor: tables.filter((table) => !table.isOutdoor),
    outdoor: tables.filter((table) => table.isOutdoor),
  }), [tables]);

  const totals = useMemo(() => ({
    tables: tables.length,
    seats: tables.reduce((sum, table) => sum + table.maximumCapacity, 0),
  }), [tables]);

  async function send(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    setError(null);
    const response = await fetch("/api/admin/v1/tables", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { data?: unknown; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message ?? "Operazione non riuscita.");
    return payload.data;
  }

  async function create(values: Draft) {
    setBusyId("new");
    try {
      const created = await send("POST", values) as TableResource;
      setTables((current) => [...current, created]);
      // Il tipo di tavolo appena inserito resta selezionato: chi configura la
      // sala aggiunge quasi sempre più tavoli uguali di fila.
      setDraft(emptyDraft(values.isOutdoor));
      setMessage(`Tavolo ${created.code} aggiunto.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusyId(null); }
  }

  async function update(id: string, values: Draft) {
    setBusyId(id);
    try {
      const updated = await send("PATCH", { id, ...values }) as TableResource;
      setTables((current) => current.map((table) => table.id === id ? updated : table));
      setEditingId(null);
      setMessage(`Tavolo ${updated.code} aggiornato.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusyId(null); }
  }

  async function remove(table: TableResource) {
    if (!window.confirm(`Eliminare il tavolo ${table.code}? Le prenotazioni già servite restano nello storico.`)) return;
    setBusyId(table.id);
    try {
      await send("DELETE", { id: table.id });
      setTables((current) => current.filter((row) => row.id !== table.id));
      setMessage(`Tavolo ${table.code} eliminato.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <Summary label="Tavoli attivi" value={String(totals.tables)} />
      <Summary label="Posti totali" value={String(totals.seats)} />
      <Summary label="Interno / esterno" value={`${groups.indoor.length} / ${groups.outdoor.length}`} />
    </div>

    {(error || message) && <p role={error ? "alert" : "status"} className={cn("rounded-lg border p-3 text-sm", error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300")}>{error ?? message}</p>}

    <Area
      title="Sala interna"
      icon={<Armchair className="size-4" />}
      tables={groups.indoor}
      isOutdoor={false}
      draft={draft}
      setDraft={setDraft}
      editingId={editingId}
      setEditingId={setEditingId}
      busyId={busyId}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
    <Area
      title="Esterno e dehors"
      icon={<Trees className="size-4" />}
      tables={groups.outdoor}
      isOutdoor
      draft={draft}
      setDraft={setDraft}
      editingId={editingId}
      setEditingId={setEditingId}
      busyId={busyId}
      onCreate={create}
      onUpdate={update}
      onRemove={remove}
    />
  </div>;
}

function Area({ title, icon, tables, isOutdoor, draft, setDraft, editingId, setEditingId, busyId, onCreate, onUpdate, onRemove }: {
  title: string;
  icon: React.ReactNode;
  tables: TableResource[];
  isOutdoor: boolean;
  draft: Draft | null;
  setDraft: (draft: Draft | null) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  busyId: string | null;
  onCreate: (values: Draft) => Promise<void>;
  onUpdate: (id: string, values: Draft) => Promise<void>;
  onRemove: (table: TableResource) => Promise<void>;
}) {
  const isAdding = draft?.isOutdoor === isOutdoor;
  const seats = tables.reduce((sum, table) => sum + table.maximumCapacity, 0);

  return <section className="overflow-hidden rounded-xl border bg-card">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        <div>
          <h2 className="font-heading text-xl leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{tables.length} tavoli · {seats} posti</p>
        </div>
      </div>
      <Button size="sm" variant={isAdding ? "secondary" : "default"} onClick={() => setDraft(isAdding ? null : { code: "", displayName: "", minimumCapacity: 2, maximumCapacity: 4, isOutdoor, isAccessible: false })}>
        {isAdding ? <><X className="size-4" />Annulla</> : <><Plus className="size-4" />Aggiungi tavolo</>}
      </Button>
    </header>

    {isAdding && draft && <TableForm
      values={draft}
      onChange={setDraft}
      busy={busyId === "new"}
      submitLabel="Aggiungi"
      onSubmit={() => void onCreate(draft)}
      onCancel={() => setDraft(null)}
    />}

    {tables.length === 0 && !isAdding
      ? <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
          Nessun tavolo configurato {isOutdoor ? "all'esterno" : "in sala"}. Aggiungine uno per renderlo prenotabile.
        </p>
      : <ul className="divide-y">
          {tables.map((table) => editingId === table.id
            ? <li key={table.id}>
                <TableForm
                  values={{ code: table.code, displayName: table.displayName, minimumCapacity: table.minimumCapacity, maximumCapacity: table.maximumCapacity, isOutdoor: table.isOutdoor, isAccessible: table.isAccessible }}
                  busy={busyId === table.id}
                  submitLabel="Salva"
                  onSubmit={(values) => void onUpdate(table.id, values)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            : <li key={table.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background font-mono text-sm font-semibold">{table.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{table.displayName}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UsersRound className="size-3" />{table.minimumCapacity}–{table.maximumCapacity} posti</span>
                    {table.isAccessible && <span>Accessibile</span>}
                    {table.status !== "available" && <Badge variant="outline" className="h-5 text-[10px]">{statusLabel(table.status)}</Badge>}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(table.id)} aria-label={`Modifica tavolo ${table.code}`}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => void onRemove(table)} disabled={busyId === table.id} aria-label={`Elimina tavolo ${table.code}`}>
                    {busyId === table.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
                  </Button>
                </div>
              </li>)}
        </ul>}
  </section>;
}

function TableForm({ values, onChange, onSubmit, onCancel, busy, submitLabel }: {
  values: Draft;
  onChange?: (values: Draft) => void;
  onSubmit: (values: Draft) => void;
  onCancel: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [local, setLocal] = useState(values);
  const current = onChange ? values : local;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    const next = { ...current, [key]: value };
    if (onChange) onChange(next); else setLocal(next);
  };
  const invalid = current.code.trim().length === 0
    || current.displayName.trim().length === 0
    || current.maximumCapacity < current.minimumCapacity;

  return <form
    className="border-b bg-background/60 px-4 py-4 sm:px-5"
    onSubmit={(event) => { event.preventDefault(); if (!invalid) onSubmit(current); }}
  >
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <Label htmlFor={`code-${current.code}`}>Numero</Label>
        <Input id={`code-${current.code}`} value={current.code} onChange={(event) => set("code", event.target.value)} placeholder="12" className="mt-2 h-11 bg-card" autoFocus />
      </div>
      <div>
        <Label htmlFor={`name-${current.code}`}>Nome</Label>
        <Input id={`name-${current.code}`} value={current.displayName} onChange={(event) => set("displayName", event.target.value)} placeholder="Tavolo finestra" className="mt-2 h-11 bg-card" />
      </div>
      <div>
        <Label htmlFor={`min-${current.code}`}>Posti minimi</Label>
        <Input id={`min-${current.code}`} type="number" min={1} max={40} value={current.minimumCapacity} onChange={(event) => set("minimumCapacity", Math.max(1, Number(event.target.value)))} className="mt-2 h-11 bg-card" />
      </div>
      <div>
        <Label htmlFor={`max-${current.code}`}>Posti massimi</Label>
        <Input id={`max-${current.code}`} type="number" min={1} max={40} value={current.maximumCapacity} onChange={(event) => set("maximumCapacity", Math.max(1, Number(event.target.value)))} className="mt-2 h-11 bg-card" />
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={current.isOutdoor} onCheckedChange={(value) => set("isOutdoor", value)} />
          All&apos;esterno
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={current.isAccessible} onCheckedChange={(value) => set("isAccessible", value)} />
          Accessibile
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Annulla</Button>
        <Button type="submit" size="sm" disabled={invalid || busy}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          {submitLabel}
        </Button>
      </div>
    </div>
    {current.maximumCapacity < current.minimumCapacity && <p className="mt-3 text-xs text-destructive">I posti massimi non possono essere meno dei minimi.</p>}
  </form>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-card px-4 py-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
  </div>;
}

function statusLabel(status: TableResource["status"]) {
  const labels: Partial<Record<TableResource["status"], string>> = {
    blocked: "Bloccato",
    out_of_service: "Fuori servizio",
    cleaning: "In riassetto",
  };
  return labels[status] ?? status;
}
