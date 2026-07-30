"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronRight, CircleUserRound, Clock3, LoaderCircle, LockKeyhole, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRestaurantLocationBySlug } from "@/config/brand";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { formatTimeInZone } from "@/lib/datetime";

type GuestAccess = {
  customerName: string;
  reservation: {
    code: string;
    status: string;
    partySize: number;
    reservationDate: string;
    startAt: string;
    restaurant: { name: string; shortName: string; slug: string; logoPath: string; address: string; city: string };
  };
};

const statusLabels: Record<string, string> = {
  confirmed: "Confermata",
  pending_approval: "In verifica",
  modified: "Aggiornata",
  arriving: "In arrivo",
  seated: "Al tavolo",
  completed: "Conclusa",
  cancelled_by_customer: "Cancellata",
  cancelled_by_restaurant: "Cancellata dal ristorante",
};

export function GuestPortal() {
  const [reservationCode, setReservationCode] = useState("");
  const [phone, setPhone] = useState("");
  const [access, setAccess] = useState<GuestAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const restaurant = access ? getRestaurantLocationBySlug(access.reservation.restaurant.slug) : undefined;

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public/v1/guest-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reservationCode, phone }),
      });
      const payload = await response.json() as { data?: GuestAccess; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Prenotazione non trovata.");
      setAccess(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Accesso non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  if (access && restaurant) {
    const reservation = access.reservation;
    return <main style={restaurantThemeStyle(restaurant)} className="dark min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-[var(--brand-surface)] text-white"><div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-4"><Link href={`/it/book/${restaurant.slug}`} className="block w-32 shrink-0 sm:w-40"><BrandLogo restaurant={restaurant} priority subtitle="Area ospite" /></Link><Button variant="outline" size="sm" onClick={() => setAccess(null)}>Esci</Button></div></header>
      <section className="japanese-pattern mx-auto max-w-4xl px-5 py-10 sm:py-16"><div className="surface-3d-dark overflow-hidden rounded-3xl border border-white/10 bg-card"><div className="relative border-b border-white/8 p-6 sm:p-9"><div aria-hidden className="absolute -right-28 -top-28 size-72 rounded-full bg-primary/12 blur-3xl" /><div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">Area ospite verificata</p><h1 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">Ciao, {access.customerName}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Qui trovi il riepilogo della tua prenotazione presso {restaurant.name}.</p></div><Badge className="rounded-full bg-emerald-400/10 text-emerald-300"><CheckCircle2 />{statusLabels[reservation.status] ?? "Ricevuta"}</Badge></div></div>
        <div className="grid gap-px bg-border sm:grid-cols-2"><PortalInfo icon={CalendarDays} label="Data" value={new Intl.DateTimeFormat("it", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${reservation.reservationDate}T12:00:00`))} /><PortalInfo icon={Clock3} label="Orario" value={formatTimeInZone(reservation.startAt)} /><PortalInfo icon={UsersRound} label="Ospiti" value={`${reservation.partySize} persone`} /><PortalInfo icon={MapPin} label="Ristorante" value={`${restaurant.shortName} · ${restaurant.city}`} /></div>
        <div className="space-y-4 p-6 sm:p-9"><div className="rounded-2xl border border-primary/20 bg-primary/[0.055] p-5"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Codice prenotazione</p><p className="mt-2 font-mono text-2xl font-semibold tracking-[0.12em]">{reservation.code}</p></div><p className="text-sm leading-6 text-muted-foreground">Per modificare o annullare la prenotazione usa il link sicuro contenuto nell&apos;email di conferma: è personale e non viene mostrato in questa area.</p><div className="flex flex-col gap-3 sm:flex-row"><Button asChild><Link href={`/it/book/${restaurant.slug}`}>Nuova prenotazione <ChevronRight /></Link></Button><Button asChild variant="outline"><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`} target="_blank" rel="noreferrer"><MapPin />Apri indicazioni</a></Button></div></div>
      </div></section>
    </main>;
  }

  return <main className="dark min-h-screen bg-[#0C0C0B] text-white"><section className="japanese-pattern mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[minmax(0,1fr)_440px]"><div className="max-w-xl"><div className="w-52"><BrandLogo priority subtitle="Area ospite" /></div><p className="mt-12 font-mono text-xs uppercase tracking-[0.26em] text-primary">Area ospite</p><h1 className="mt-4 font-heading text-5xl leading-[1.02] tracking-tight sm:text-6xl">La tua prenotazione, sempre a portata di mano.</h1><p className="mt-6 text-base leading-7 text-white/60">Accedi con il codice ricevuto e il numero di telefono usato in prenotazione. Vedrai subito ristorante, orario e stato della richiesta.</p><div className="mt-8 grid gap-3 text-sm text-white/65 sm:grid-cols-2"><span className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" />Verifica protetta</span><span className="flex items-center gap-2"><CircleUserRound className="size-4 text-primary" />YUKO e KouSushi</span></div></div>
      <form onSubmit={signIn} className="surface-3d-dark rounded-3xl border border-white/10 bg-[#171716] p-6 sm:p-8"><span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary"><LockKeyhole className="size-5" /></span><p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-white/45">Accesso prenotazione</p><h2 className="mt-3 font-heading text-3xl">Bentornato.</h2><p className="mt-3 text-sm leading-6 text-white/55">Non serve una password: confrontiamo i dati con la prenotazione registrata.</p><div className="mt-8 space-y-5"><div><Label htmlFor="reservation-code" className="text-white/80">Codice prenotazione</Label><Input id="reservation-code" value={reservationCode} onChange={(event) => setReservationCode(event.target.value.toUpperCase())} placeholder="YK-2401" autoCapitalize="characters" required className="mt-2 h-12 border-white/10 bg-black/20" /></div><div><Label htmlFor="guest-phone" className="text-white/80">Numero di telefono</Label><Input id="guest-phone" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Il numero usato in prenotazione" required className="mt-2 h-12 border-white/10 bg-black/20" /></div>{error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-rose-200">{error}</p>}<Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <LockKeyhole />}{loading ? "Verifica in corso…" : "Apri la mia prenotazione"}</Button></div><p className="mt-5 text-center text-xs leading-5 text-white/38">Il link sicuro nell&apos;email di conferma consente anche modifiche e cancellazioni.</p></form>
    </section></main>;
}

function PortalInfo({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return <div className="bg-card p-5 sm:p-6"><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}</p><p className="mt-3 text-sm font-medium capitalize">{value}</p></div>;
}
