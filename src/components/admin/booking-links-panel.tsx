"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantLocation } from "@/config/brand";

export function BookingLinksPanel({ locations, configuredBaseUrl }: { locations: readonly RestaurantLocation[]; configuredBaseUrl?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => current === key ? null : current), 1800);
  }

  // Solo i link di questo ristorante: la pagina che sceglie fra i due locali
  // non è roba che questo pannello debba pubblicizzare.
  const rows = locations.map((location) => ({ key: location.slug, label: location.shortName, description: `Da mettere su Google, sito e social · ${location.city}`, path: `/it/book/${location.slug}` }));

  return <section className="surface-3d-dark mb-6 overflow-hidden rounded-2xl border bg-card" aria-labelledby="booking-links-title">
    <div className="border-b p-5 sm:p-6"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Presenza digitale</p><h2 id="booking-links-title" className="mt-2 font-heading text-2xl font-semibold tracking-tight">Link pubblico di prenotazione</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">È l’indirizzo da dare ai clienti: sito, social e campo “prenotazione” della scheda Google. Porta direttamente alla pagina di questo ristorante.</p></div>
    <div className="divide-y">{rows.map((row) => {
      const url = configuredBaseUrl ? `${configuredBaseUrl}${row.path}` : row.path;
      return <div key={row.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[40px_180px_minmax(0,1fr)_auto] sm:items-center sm:px-6"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Link2 className="size-4" /></span><div><p className="text-sm font-medium">{row.label}</p><p className="mt-1 text-xs text-muted-foreground">{row.description}</p></div><code className="min-w-0 truncate rounded-lg bg-background/60 px-3 py-2 text-xs text-muted-foreground">{url}</code><div className="flex gap-2"><Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" onClick={() => void copy(configuredBaseUrl ? url : `${window.location.origin}${row.path}`, row.key)} aria-label={`Copia link ${row.label}`}>{copied === row.key ? <Check /> : <Copy />}</Button><Button asChild variant="outline" size="icon" className="min-h-11 min-w-11"><Link href={row.path} target="_blank" aria-label={`Apri ${row.label}`}><ExternalLink /></Link></Button></div></div>;
    })}</div>
  </section>;
}
