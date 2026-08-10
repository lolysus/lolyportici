"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Info, LoaderCircle, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimeInZone } from "@/lib/datetime";
import type { PublicReservation } from "@/repositories/repository";

const customerManageableStatuses = new Set(["confirmed", "modified"]);

export function ManageBooking({ token, locale }: { token: string; locale: string }) {
  const [reservation, setReservation] = useState<PublicReservation | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/public/v1/reservations/manage/${token}`).then(async (response) => {
      const payload = await response.json() as { data?: PublicReservation; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Prenotazione non trovata.");
      setReservation(payload.data);
      setPartySize(payload.data.partySize);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Prenotazione non trovata.")).finally(() => setLoading(false));
  }, [token]);

  async function update() {
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 100) {
      setError("Inserisci un numero di ospiti valido.");
      return;
    }
    setLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/public/v1/reservations/manage/${token}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ partySize }) });
      const payload = await response.json() as { data?: PublicReservation; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Aggiornamento non riuscito.");
      setReservation(payload.data);
      setPartySize(payload.data.partySize);
      setMessage("Prenotazione aggiornata. Abbiamo verificato nuovamente la disponibilità del servizio.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Aggiornamento non riuscito."); }
    finally { setLoading(false); }
  }

  async function cancel() {
    if (!window.confirm("Vuoi cancellare definitivamente la prenotazione?")) return;
    setLoading(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/public/v1/reservations/manage/${token}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Cancellazione online del cliente" }) });
      const payload = await response.json() as { data?: PublicReservation; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Cancellazione non riuscita.");
      setReservation(payload.data);
      setMessage("Prenotazione cancellata.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cancellazione non riuscita."); }
    finally { setLoading(false); }
  }

  if (loading && !reservation) return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="size-6 animate-spin" /><span className="sr-only">Caricamento</span></div>;
  if (error && !reservation) return <div className="mx-auto max-w-lg px-5 py-24 text-center"><AlertTriangle className="mx-auto mb-5 size-10 text-destructive" /><h1 className="font-heading text-3xl">Prenotazione non disponibile</h1><p className="mt-3 text-muted-foreground">{error}</p><Button asChild variant="outline" className="mt-8"><Link href={`/${locale}/book`}><ArrowLeft />Torna ai ristoranti</Link></Button></div>;
  if (!reservation) return null;

  const cancelled = reservation.status.startsWith("cancelled");
  const canManage = customerManageableStatuses.has(reservation.status);
  return <div className="mx-auto max-w-2xl px-5 py-12 sm:py-20"><p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Prenotazione {reservation.reservationCode}</p><div className="mt-4 flex items-center gap-3"><CheckCircle2 className="size-7 text-primary" /><h1 className="font-heading text-4xl">Gestisci prenotazione</h1></div>
    <div className="my-9 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2"><InfoCard icon={<CalendarDays />} label="Data e ora" value={`${new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(`${reservation.reservationDate}T12:00:00`))} · ${formatTimeInZone(reservation.startAt)}`} /><InfoCard icon={<UsersRound />} label="Ospiti" value={`${reservation.partySize} persone`} /></div>
    {message && <p role="status" className="mb-6 rounded-lg bg-primary/10 p-4 text-sm text-primary">{message}</p>}{error && <p role="alert" className="mb-6 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {canManage ? <div className="rounded-2xl border bg-card p-5 sm:p-6"><div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0 text-primary" /><p>Puoi aggiornare il numero di ospiti. Ogni modifica viene controllata in tempo reale rispetto alla capienza del servizio.</p></div><div className="mt-6"><Label htmlFor="party-size">Numero di persone</Label><div className="mt-3 flex flex-wrap gap-3"><Input id="party-size" type="number" min={1} max={100} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} className="w-28" /><Button onClick={() => void update()} disabled={loading || partySize === reservation.partySize}>{loading && <LoaderCircle className="animate-spin" />}Aggiorna</Button></div></div><div className="mt-8 border-t pt-6"><p className="mb-3 text-sm text-muted-foreground">Puoi cancellare la prenotazione entro il termine stabilito dal ristorante.</p><Button variant="destructive" onClick={() => void cancel()} disabled={loading}>Cancella prenotazione</Button></div></div> : <div className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">{cancelled ? "Questa prenotazione è stata cancellata." : "Questa prenotazione è già in gestione dal ristorante e non può più essere modificata online. Contatta direttamente la sede per assistenza."}</div>}
  </div>;
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex gap-3 bg-card p-5"><span className="text-muted-foreground [&_svg]:size-5">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div></div>; }
