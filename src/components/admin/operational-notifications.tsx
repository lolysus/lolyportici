"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CalendarCheck2, Check, Clock3, MapPin, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RestaurantLocation } from "@/config/brand";
import { useReservationRealtime } from "@/hooks/use-reservation-realtime";
import { cn } from "@/lib/utils";
import type { PublicReservation } from "@/repositories/repository";

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
type FeedState = "syncing" | "ready" | "offline";

function getSoundPreferenceKey(scope: string) {
  return `regia-sushi-notification-sound:${scope}`;
}

function getSoundPreference(key: string) {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(key) !== "off";
}

export function OperationalNotifications({ location }: { location: RestaurantLocation }) {
  const router = useRouter();
  const [items, setItems] = useState<PublicReservation[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const soundPreferenceKey = getSoundPreferenceKey(location.id);
  const [soundEnabled, setSoundEnabled] = useState(() => getSoundPreference(soundPreferenceKey));
  const [audioReady, setAudioReady] = useState(false);
  const [toast, setToast] = useState<PublicReservation | null>(null);
  const [feedState, setFeedState] = useState<FeedState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlockAudio = useCallback(async (force = false) => {
    if ((!soundEnabled && !force) || typeof window === "undefined") return null;
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
  }, [soundEnabled]);

  const playChime = useCallback(async (force = false) => {
    const context = await unlockAudio(force);
    if (!context) return false;
    const now = context.currentTime;
    [0, 0.22, 0.44].forEach((offset) => {
      [1046.5, 1318.5].forEach((frequency, overtone) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + offset;
        oscillator.type = overtone === 0 ? "sine" : "triangle";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(overtone === 0 ? 0.2 : 0.07, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.025, start + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.86);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.9);
      });
    });
    return true;
  }, [unlockAudio]);

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
          void playChime();
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 8000);
        }
      }
      seenIds.current = nextIds;
      setItems(rows.slice(0, 8));
      setFeedState("ready");
      setLastSyncedAt(Date.now());
    } catch {
      setFeedState("offline");
    }
  }, [playChime]);

  const realtimeRefresh = useCallback(() => { void loadReservations(true); }, [loadReservations]);
  useReservationRealtime(realtimeRefresh, { locationId: location.id });

  useEffect(() => {
    seenIds.current = null;
    const initialLoad = window.setTimeout(() => void loadReservations(false), 0);
    const interval = window.setInterval(() => void loadReservations(true), 15_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
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
    const syncPreference = (event: StorageEvent) => {
      if (event.key === soundPreferenceKey) setSoundEnabled(event.newValue !== "off");
    };
    window.addEventListener("storage", syncPreference);
    return () => window.removeEventListener("storage", syncPreference);
  }, [soundPreferenceKey]);

  useEffect(() => {
    if (!soundEnabled) return;
    const prime = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", prime, { once: true, passive: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, [soundEnabled, unlockAudio]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    const context = audioContext.current;
    audioContext.current = null;
    void context?.close();
  }, []);

  async function toggleSound() {
    const next = !soundEnabled;
    try {
      window.localStorage.setItem(soundPreferenceKey, next ? "on" : "off");
    } catch {
      // The current dashboard still honors the choice if browser storage is unavailable.
    }
    setSoundEnabled(next);
    if (next) {
      await playChime(true);
      return;
    }
    const context = audioContext.current;
    audioContext.current = null;
    setAudioReady(false);
    void context?.close();
  }

  function testChime() {
    void playChime(true);
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
        <Button variant="ghost" size="icon" className="notification-bell-trigger relative min-h-11 min-w-11 touch-manipulation lg:min-h-9 lg:min-w-9" data-sound-status={!soundEnabled ? "muted" : audioReady ? "armed" : "pending"} aria-label="Apri notifiche operative">
          {unread > 0 ? <BellRing /> : <Bell />}
          {unread > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold text-primary-foreground">{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="dark w-[min(420px,calc(100vw-1.25rem))] overflow-hidden border-white/10 bg-card p-0 text-foreground shadow-2xl">
        <div className="border-b border-white/8 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-heading text-lg">Notifiche operative</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" />{location.shortName}</p></div>
            <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium", feedState === "offline" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-emerald-400/20 bg-emerald-400/8 text-emerald-200")}><span className={cn("size-1.5 rounded-full", feedState === "offline" ? "bg-destructive" : "bg-emerald-400", feedState === "syncing" && "animate-pulse")} />{feedState === "offline" ? "Riprovo" : feedState === "syncing" ? "Aggiorno" : "In ascolto"}</span>
          </div>
          <div className={cn("mt-4 rounded-xl border p-3.5", soundEnabled ? "border-primary/20 bg-primary/[0.055]" : "border-white/8 bg-white/[0.025]")}>
            <div className="flex items-start gap-3">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl border", soundEnabled ? "border-primary/20 bg-primary/12 text-primary" : "border-white/10 bg-white/[0.035] text-muted-foreground")}>{soundEnabled ? <BellRing className={cn("size-4", audioReady && "signal-pulse")} /> : <VolumeX className="size-4" />}</span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{!soundEnabled ? "Campanella disattivata" : audioReady ? "Campanella pronta" : "Attiva la campanella"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{!soundEnabled ? "Questa dashboard rimane silenziosa finche non riattivi l'avviso." : audioReady ? "Ogni nuova prenotazione ricevera un segnale immediato." : "Un tocco abilita l'audio per questa dashboard, come richiesto dal browser."}</p></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void toggleSound()} className={cn("flex min-h-10 touch-manipulation items-center justify-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors", soundEnabled ? "border-white/10 bg-card/70 text-foreground hover:border-primary/40" : "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90")} aria-pressed={soundEnabled}>
                {soundEnabled ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}{soundEnabled ? "Disattiva" : "Attiva"}
              </button>
              <button type="button" onClick={testChime} disabled={!soundEnabled} className="flex min-h-10 touch-manipulation items-center justify-center gap-2 rounded-lg border border-white/10 bg-card/70 px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-45">
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

    {toast && <div role="status" aria-live="polite" className="surface-3d-dark fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-[90] w-[min(390px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-primary/25 bg-card text-foreground shadow-2xl md:bottom-5 md:right-5">
      <div className="service-route h-0.5" />
      <div className="flex items-start gap-3 p-4">
        <span className="signal-pulse flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BellRing className="size-4" /></span>
        <div className="min-w-0 flex-1"><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Nuova prenotazione - {location.shortName}</p><p className="mt-1 font-medium">{toast.customer.firstName} {toast.customer.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{toast.partySize} ospiti - {toast.reservationCode}</p><button type="button" onClick={() => openReservation(toast)} className="mt-3 text-xs font-semibold text-primary underline-offset-4 hover:underline">Apri prenotazione</button></div>
        <button type="button" onClick={() => setToast(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Chiudi notifica"><X className="size-4" /></button>
      </div>
    </div>}
  </>;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ora" : new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatSyncTime(value: number) {
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(value);
}
