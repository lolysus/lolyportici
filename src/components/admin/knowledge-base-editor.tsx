"use client";

import { useState } from "react";
import { Bot, CheckCircle2, LoaderCircle, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeBaseItem } from "@/types/domain";

type ApiPayload = { data?: KnowledgeBaseItem; error?: { message: string } };

export function KnowledgeBaseEditor({ initialItems, assistantName }: { initialItems: KnowledgeBaseItem[]; assistantName: string }) {
  const [items, setItems] = useState(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[0]?.id ?? null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId);

  function change(values: Partial<KnowledgeBaseItem>) {
    if (!selectedId) return;
    setItems((current) => current.map((item) => item.id === selectedId ? { ...item, ...values } : item));
    setSaved(false);
  }

  async function add() {
    setPending(true); setError(null); setSaved(false);
    const response = await fetch("/api/admin/v1/knowledge-base", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category: "Nuova", question: "Nuova domanda", answer: "", language: "it", isPublic: true, isActive: false, priority: 0 }),
    });
    const payload = await response.json() as ApiPayload;
    setPending(false);
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Creazione non riuscita."); return; }
    setItems((current) => [...current, payload.data!]);
    setSelectedId(payload.data.id);
  }

  async function save() {
    if (!selected) return;
    setPending(true); setError(null); setSaved(false);
    const response = await fetch("/api/admin/v1/knowledge-base", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(selected),
    });
    const payload = await response.json() as ApiPayload;
    setPending(false);
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? "Salvataggio non riuscito."); return; }
    setItems((current) => current.map((item) => item.id === payload.data!.id ? payload.data! : item));
    setSaved(true);
  }

  return <>
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-heading text-lg">Contenuti</h2>
          <Button size="icon" variant="ghost" onClick={add} disabled={pending}><Plus/><span className="sr-only">Nuovo contenuto</span></Button>
        </div>
        <div className="space-y-1 p-2">{items.length ? items.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setSaved(false); setError(null); }} className={`w-full rounded-lg p-3 text-left ${selectedId === item.id ? "bg-primary/10" : "hover:bg-muted/50"}`}><div className="flex items-center justify-between gap-2"><Badge variant="outline">{item.category}</Badge>{item.isActive && <span className="size-1.5 rounded-full bg-emerald-400"/>}</div><p className="mt-2 text-sm font-medium">{item.question}</p></button>) : <p className="p-5 text-center text-xs text-muted-foreground">Aggiungi il primo contenuto verificato.</p>}</div>
      </div>
      <div className="rounded-xl border bg-card p-6">
        {selected ? <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-[1fr_120px]"><div><Label htmlFor="kb-category">Categoria</Label><Input id="kb-category" value={selected.category} onChange={(event) => change({ category: event.target.value })} className="mt-2"/></div><div><Label htmlFor="kb-language">Lingua</Label><Select value={selected.language} onValueChange={(language) => change({ language: language as KnowledgeBaseItem["language"] })}><SelectTrigger id="kb-language" className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="it">Italiano</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select></div></div>
          <div><Label htmlFor="kb-question">Domanda</Label><Input id="kb-question" value={selected.question} onChange={(event) => change({ question: event.target.value })} className="mt-2"/></div>
          <div><Label htmlFor="kb-answer">Risposta verificata</Label><Textarea id="kb-answer" value={selected.answer} onChange={(event) => change({ answer: event.target.value })} className="mt-2 min-h-40"/></div>
          <div className="grid gap-3 sm:grid-cols-2"><ToggleRow id="kb-public" label="Pubblico" checked={selected.isPublic} change={(isPublic) => change({ isPublic })}/><ToggleRow id="kb-active" label="Attivo per l’AI" checked={selected.isActive} change={(isActive) => change({ isActive })}/></div>
          <Button onClick={save} disabled={pending}>{pending ? <LoaderCircle className="animate-spin"/> : saved ? <CheckCircle2/> : <Save/>}{pending ? "Salvataggio…" : saved ? "Salvato" : "Salva contenuto"}</Button>
        </div> : <div className="flex min-h-80 items-center justify-center text-sm text-muted-foreground">Seleziona o aggiungi un contenuto.</div>}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-2 text-primary"><Bot className="size-5"/><h2 className="font-heading text-xl">Anteprima AI</h2></div>
        <div className="mt-5 rounded-xl bg-background p-4"><p className="text-xs text-muted-foreground">Ospite</p><p className="mt-1 text-sm">{selected?.question ?? "Nessuna domanda selezionata"}</p></div>
        <div className="mt-3 rounded-xl border border-primary/15 bg-primary/8 p-4"><p className="text-xs text-primary">Assistente {assistantName}</p><p className="mt-2 text-sm leading-6">{selected?.answer || "La knowledge base non contiene ancora una risposta verificata. Trasferisco la richiesta al personale."}</p></div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">L’assistente non risponde oltre i contenuti attivi e pubblici.</p>
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </>;
}

function ToggleRow({ id, label, checked, change }: { id: string; label: string; checked: boolean; change: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-lg border p-4"><Label htmlFor={id}>{label}</Label><Switch id={id} checked={checked} onCheckedChange={change}/></div>;
}
