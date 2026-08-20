"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, BellRing, CalendarCheck2, CalendarDays, Check, Clock3, MapPin, PartyPopper, Phone, RefreshCw, UsersRound, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RestaurantLocation } from "@/config/brand";
import { formatTimeInZone } from "@/lib/datetime";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { useReservationStream } from "@/hooks/use-reservation-stream";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { claimReservationAnnouncement } from "@/lib/notification-preferences";
import { findNotificationSound } from "@/lib/notification-sounds";
import { cn } from "@/lib/utils";
import type { PublicReservation } from "@/repositories/repository";

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
type FeedState = "syncing" | "ready" | "offline";

export function OperationalNotifications({ location }: { location: RestaurantLocation }) {
  const router = useRouter();
  const [items, setItems] = useState<PublicReservation[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const [preferences] = useNotificationPreferences(location.id);
  const [audioReady, setAudioReady] = useState(false);
  const [toast, setToast] = useState<PublicReservation | null>(null);
  const [toastExtra, setToastExtra] = useState(0);
  const [feedState, setFeedState] = useState<FeedState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlockAudio = useCallback(async () => {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (audioContext.current?.state === "closed") audioContext.current = null;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    try {
      await context.resume();
      const ready = context.state === "running";
      setAudioReady(ready);
      return ready ? context : null;
    } catch {
      setAudioReady(false);
      return null;
    }
  }, []);

  const playChime = useCallback(async () => {
    const context = await unlockAudio();
    if (!context) return false;
    findNotificationSound(preferences.soundId).play(context, preferences.volume);
    return true;
  }, [unlockAudio, preferences.soundId, preferences.volume]);

  const loadReservations = useCallback(async (notify: boolean) => {
    try {
      const response = await fetch("/api/admin/v1/reservations", { cache: "no-store" });
      if (!response.ok) {
        setFeedState("offline");
        return;
      }
      const payload = (await response.json()) as { data?: PublicReservation[] };
      const rows = [...(payload.data ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const nextIds = new Set(rows.map((row) => row.id));
      const previousIds = seenIds.current;
      if (notify && previousIds) {
        const created = rows.filter((row) => !previousIds.has(row.id));
        if (created.length > 0) {
          setUnread((current) => current + created.length);
          setToast(created[0]);
          setToastExtra(created.length - 1);
          // Con più schede del pannello aperte suonerebbero tutte: la prima che
          // rivendica la prenotazione annuncia, le altre mostrano e restano
          // zitte. L'avviso a schermo resta in ognuna, perché lì il doppione
          // non disturba.
          if (created.some((row) => claimReservationAnnouncement(location.id, row.id))) void playChime();
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => { setToast(null); setToastExtra(0); }, 11000);
        }
      }
      seenIds.current = nextIds;
      setItems(rows.slice(0, 8));
      setFeedState("ready");
      setLastSyncedAt(Date.now());
    } catch {
      setFeedState("offline");
    }
  }, [playChime, location.id]);

  // Il database avvisa, la dashboard non chiede più: l'evento arriva in meno di
  // un secondo invece dei quindici del vecchio giro. L'interrogazione resta come
  // rete di sicurezza, con il passo che il flusso decide.
  const streamState = useReservationStream(
    useCallback(() => { void loadReservations(true); }, [loadReservations]),
    useCallback(() => { void loadReservations(true); }, [loadReservations]),
  );

  useEffect(() => {
    seenIds.current = null;
    const initialLoad = window.setTimeout(() => void loadReservations(false), 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadReservations, location.id]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void loadReservations(true);
    };
    document.addEventListener("visibilitychange", refreshOnFocus);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", refreshOnFocus);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadReservations]);

  useEffect(() => {
    const prime = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", prime, { once: true, passive: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [unlockAudio]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const context = audioContext.current;
    audioContext.current = null;
    void context?.close();
  }, []);

  function testChime() {
    void playChime();
  }

  function openReservation(reservation: PublicReservation) {
    setOpen(false);
    // L'agenda vive nel ramo della sede: senza il prefisso si uscirebbe dal
    // pannello del ristorante a ogni notifica aperta.
    router.push(`/admin/${location.slug}/reservations?date=${reservation.reservationDate}&reservation=${reservation.id}`);
    router.refresh();
  }

  return <>
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) { setUnread(0); void loadReservations(false); } }}>
      <PopoverTrigger asChild>
        {/* `size-11` perdeva contro il `size-8` della variante "icon": sono la
            stessa utility, e a decidere è l'ordine nel foglio di stile, non
            l'ordine scritto qui. `min-h`/`min-w` sono proprietà diverse e
            vincono comunque, così il bersaglio resta da 44px sotto il dito. */}
        <Button variant="ghost" size="icon" className="notification-bell-trigger relative min-h-11 min-w-11 touch-manipulation lg:min-h-9 lg:min-w-9" data-sound-status={audioReady ? "armed" : "pending"} aria-label="Apri notifiche operative">
          {unread > 0 ? <BellRing /> : <Bell />}
          {unread > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold text-primary-foreground">{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="dark w-[min(420px,calc(100vw-1.25rem))] overflow-hidden border-white/10 bg-card p-0 text-foreground shadow-2xl">
        <div className="border-b border-white/8 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-heading text-lg">Notifiche operative</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" />{location.shortName}</p></div>
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", feedState === "offline" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-emerald-400/20 bg-emerald-400/8 text-emerald-200")}><span className={cn("size-1.5 rounded-full", feedState === "offline" ? "bg-destructive" : "bg-emerald-400", feedState === "syncing" && "animate-pulse")} />{feedState === "offline" ? "Riprovo" : streamState === "live" ? "In diretta" : "Controllo"}</span>
          </div>
          {/* La campanella non si spegne più: l'unica cosa che può ancora
              renderla muta è il browser, che pretende un tocco prima di far
              suonare qualsiasi cosa. Finché quel tocco non arriva il riquadro
              lo dice, e resta acceso. */}
          <div className={cn("mt-4 rounded-xl border p-3.5", audioReady ? "border-primary/20 bg-primary/[0.055]" : "border-amber-400/25 bg-amber-400/[0.07]")}>
            <div className="flex items-start gap-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", audioReady ? "border-primary/20 bg-primary/12 text-primary" : "border-amber-400/25 bg-amber-400/10 text-amber-300")}>{audioReady ? <BellRing className="size-4 signal-pulse" /> : <Volume2 className="size-4" />}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{audioReady ? "Campanella pronta" : "Abilita l'audio di questo dispositivo"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{audioReady ? "Ogni nuova prenotazione suona: l'avviso non si puo disattivare." : "Il browser fa suonare solo dopo un tocco su questa pagina. Premi qui sotto: e l'unico passaggio che manca."}</p></div>
            </div>
            <div className="mt-3">
              <button type="button" onClick={testChime} className={cn("flex min-h-10 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors", audioReady ? "border-white/10 bg-card/70 text-foreground hover:border-primary/40" : "border-amber-400/30 bg-amber-400/90 text-[#1b1400] hover:bg-amber-300")}>
                <Bell className="size-3.5" />{audioReady ? "Prova suono" : "Abilita audio"}
              </button>
            </div>
          </div>
        </div>
        <div className="max-h-[420px] divide-y divide-white/8 overflow-y-auto">
          {items.map((reservation) => {

            return <button key={reservation.id} type="button" onClick={() => openReservation(reservation)} className="grid min-h-[72px] w-full grid-cols-[38px_minmax(0,1fr)_auto] gap-3 p-4 text-left transition-colors hover:bg-white/[0.035]">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarCheck2 className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti - {reservation.reservationCode}</span></span>
              <time className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock3 className="size-3" />{formatCreatedAt(reservation.createdAt)}</time>
            </button>;
          })}
          {items.length === 0 && <div className="px-5 py-10 text-center"><Check className="mx-auto size-5 text-emerald-300" /><p className="mt-3 text-sm font-medium">Nessuna notifica recente</p><p className="mt-1 text-xs text-muted-foreground">Le nuove prenotazioni compariranno qui.</p></div>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-background/30 px-4 py-3 text-[11px] leading-4 text-muted-foreground"><span>{feedState === "offline" ? "Connessione in ripristino: il controllo continua automaticamente." : lastSyncedAt ? `Ultimo controllo ${formatSyncTime(lastSyncedAt)}.` : "Sincronizzazione in corso."}</span><button type="button" onClick={() => void loadReservations(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-white/7"><RefreshCw className="size-3" />Aggiorna</button></div>
      </PopoverContent>
    </Popover>

    {toast && typeof document !== "undefined" && createPortal(<div role="status" aria-live="polite" style={restaurantThemeStyle(location)} className="dark surface-3d-dark fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-[100] w-[min(400px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-primary/30 bg-card text-foreground shadow-2xl md:bottom-5 md:right-5">
      <div className="service-route h-0.5" />
      <div className="flex items-start gap-3 p-4">
        <span className="signal-pulse flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BellRing className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Nuova prenotazione · {location.shortName}</p>
            {toastExtra > 0 && <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[9px] font-semibold text-primary">+{toastExtra} altre</span>}
          </div>
          <p className="mt-1 truncate font-heading text-lg">{toast.customer.firstName} {toast.customer.lastName}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {!isToday(toast.reservationDate, location.timezone) && <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5 text-primary" />{formatReservationDay(toast.reservationDate)}</span>}
            <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5 text-primary" />{formatTimeInZone(toast.startAt, location.timezone)}</span>
            <span className="inline-flex items-center gap-1"><UsersRound className="size-3.5 text-primary" />{toast.partySize} {toast.partySize === 1 ? "ospite" : "ospiti"}</span>
            <span className="inline-flex items-center gap-1 font-mono">{toast.reservationCode}</span>
          </div>
          {toast.specialOccasion && <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary"><PartyPopper className="size-3.5" />{toast.specialOccasion}</p>}
          {toast.customer.allergies && <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1.5 text-xs font-medium text-amber-200"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Allergie: {toast.customer.allergies}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => openReservation(toast)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"><CalendarCheck2 className="size-3.5" />Apri prenotazione</button>
            {toast.customer.phone && <a href={`tel:${toast.customer.phone}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/12 px-3 text-xs font-medium text-foreground hover:border-primary/40"><Phone className="size-3.5 text-primary" />Chiama</a>}
          </div>
        </div>
        <button type="button" onClick={() => { setToast(null); setToastExtra(0); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Chiudi notifica"><X className="size-4" /></button>
      </div>
    </div>, document.body)}
  </>;
}

/** Il giorno della prenotazione è oggi (nel fuso della sede)? */
function isToday(dateKey: string, timezone: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return dateKey === today;
}

function formatReservationDay(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateKey : new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ora" : new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatSyncTime(value: number) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(value);
}
