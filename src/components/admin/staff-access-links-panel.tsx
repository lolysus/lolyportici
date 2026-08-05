"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StaffAccessLink {
  slug: string;
  label: string;
  city: string;
  path: string;
}

/**
 * Gli indirizzi riservati con cui i due ristoranti entrano nel proprio
 * pannello. Non sono linkati da nessuna parte: se non li può copiare da qui,
 * il titolare non ha modo di consegnarli.
 */
export function StaffAccessLinksPanel({ links, configuredBaseUrl }: { links: readonly StaffAccessLink[]; configuredBaseUrl?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
  }

  return <section className="mb-6 overflow-hidden rounded-2xl border bg-card" aria-labelledby="staff-access-title">
    <div className="border-b p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Accessi staff</p>
      <h2 id="staff-access-title" className="mt-2 font-heading text-2xl font-semibold tracking-tight">L’ingresso riservato di questo ristorante</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">È l’indirizzo con cui il personale entra in questo pannello: diverso da quello dei clienti e non raggiungibile dal sito. Dallo solo a chi lavora qui.</p>
    </div>
    <div className="divide-y">{links.map((link) => {
      const url = configuredBaseUrl ? `${configuredBaseUrl}${link.path}` : link.path;
      return <div key={link.slug} className="grid gap-3 px-5 py-4 sm:grid-cols-[40px_180px_minmax(0,1fr)_auto] sm:items-center sm:px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-4" /></span>
        <div><p className="text-sm font-medium">{link.label}</p><p className="mt-1 text-xs text-muted-foreground">{link.city}</p></div>
        <code className="min-w-0 truncate rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">{url}</code>
        <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" onClick={() => void copy(configuredBaseUrl ? url : `${window.location.origin}${link.path}`, link.slug)} aria-label={`Copia accesso ${link.label}`}>{copied === link.slug ? <Check /> : <Copy />}</Button>
      </div>;
    })}</div>
    <p className="flex items-start gap-2 border-t bg-amber-500/[0.06] px-5 py-3.5 text-xs leading-5 text-amber-200/90 sm:px-6"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" />Trattali come una chiave: se un indirizzo gira più del dovuto si sostituisce cambiando <code className="font-mono">ADMIN_ACCESS_PATHS</code> nelle variabili d’ambiente, senza toccare il codice.</p>
  </section>;
}
