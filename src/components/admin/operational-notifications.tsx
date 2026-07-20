"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CalendarCheck2, Check, Clock3, MapPin, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { RestaurantLocation } from "@/config/brand";
import { useReservationRealtime } from "@/hooks/use-reservation-realtime";
import type { PublicReservation } from "@/repositories/repository";
import { cn } from "@/lib/utils";

const soundPreferenceKey = "regia-sushi-notification-sound";
const soundPreferenceEvent = "regia-sushi-sound-preference";

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

function subscribeSoundPreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(soundPreferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(soundPreferenceEvent, callback);
  };
}

function getSoundPreference() {
  return window.localStorage.getItem(soundPreferenceKey) !== "off";
}

export function OperationalNotifications({ location, locations }: { location: RestaurantLocation; locations?: readonly RestaurantLocation[] }) {
  const router = useRouter();
  const [items, setItems] = useState<PublicReservation[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const soundEnabled = useSyncExternalStore(subscribeSoundPreference, getSoundPreference, () => true);
  const [audioReady, setAudioReady] = useState(false);
  const [toast, setToast] = useState<PublicReservation | null>(null);
  const seenIds = useRef<Set<string> | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorAllLocations = Boolean(locations && locations.length > 1);
  const monitoredLocations = locations?.length ? locations : [location];

  const unlockAudio = useCallback(async () => {
    if (!soundEnabled || typeof window === "undefined") return false;
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return false;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    try {
      await context.resume();
      setAudioReady(context.state === "running");
      return context.state === "running";
    } catch {
      return false;
    }
  }, [soundEnabled]);

  const playChime = useCallback((force = false) => {
    if ((!soundEnabled && !force) || typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    void context.resume().then(() => {
      setAudioReady(context.state === "running");
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
    }).catch(() => undefined);
  }, [soundEnabled]);

  const loadReservations = useCallback(async (notify: boolean) => {
    try {
      const response = await fetch(`/api/admin/v1/reservations${monitorAllLocations ? "?scope=all" : ""}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { data?: PublicReservation[] };
      const rows = [...(payload.data ?? [])].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const nextIds = new Set(rows.map((row) => row.id));
      const previousIds = seenIds.current;
      if (notify && previousIds) {
        const created = rows.filter((row) => !previousIds.has(row.id));
        if (created.length > 0) {
          setUnread((current) => current + created.length);
          setToast(created[0]);
          playChime();
          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 8000);
        }
      }
      seenIds.current = nextIds;
      setItems(rows.slice(0, 8));
    } catch {
      // Realtime status already communicates connection failures; polling retries automatically.
    }
  }, [monitorAllLocations, playChime]);

  const realtimeRefresh = useCallback(() => { void loadReservations(true); }, [loadReservations]);
  useReservationRealtime(realtimeRefresh, monitorAllLocations ? {} : { locationId: location.id });

  useEffect(() => {
    seenIds.current = null;
    void loadReservations(false);
    const interval = window.setInterval(() => void loadReservations(true), 15_000);
    return () => window.clearInterval(interval);
  }, [loadReservations, location.id, monitorAllLocations]);

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
    void audioContext.current?.close();
  }, []);

  function toggleSound() {
    const next = !soundEnabled;
    window.localStorage.setItem(soundPreferenceKey, next ? "on" : "off");
    window.dispatchEvent(new Event(soundPreferenceEvent));
    if (next) {
      void unlockAudio();
      playChime(true);
    } else setAudioReady(false);
  }

  function testChime() {
    void unlockAudio();
    playChime(true);
  }

  async function openReservation(reservation: PublicReservation) {
    const reservationLocation = monitoredLocations.find((item) => item.id === reservation.locationId);
    setOpen(false);
    if (monitorAllLocations && reservationLocation && reservationLocation.id !== location.id) {
      const response = await fetch("/api/admin/v1/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: reservationLocation.slug }),
      });
      if (!response.ok) return;
    }
    router.push(`/admin/reservations?date=${reservation.reservationDate}&reservation=${reservation.id}`);
    router.refresh();
  }

  const toastLocation = toast ? monitoredLocations.find((item) => item.id === toast.locationId) : undefined;

  return <>
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setUnread(0); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `${unread} nuove prenotazioni` : "Apri notifiche operative"}>
          {unread > 0 ? <BellRing /> : <Bell />}
          {unread > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-semibold text-primary-foreground">{Math.min(unread, 9)}{unread > 9 ? "+" : ""}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="dark w-[min(390px,calc(100vw-2rem))] overflow-hidden border-white/10 bg-card p-0 text-foreground">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 p-4">
          <div><p className="font-heading text-lg">Notifiche operative</p><p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3" />{monitorAllLocations ? "YUKO + KouSushi" : location.shortName}</p></div>
          <div className="flex items-center gap-1.5">
            {soundEnabled && <button type="button" onClick={testChime} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/45 hover:text-foreground">{audioReady ? "Testa campana" : "Attiva campana"}</button>}
            <button type="button" onClick={toggleSound} className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1.5 text-[10px] font-medium", soundEnabled ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-200" : "border-white/10 text-muted-foreground")} aria-pressed={soundEnabled}>
              {soundEnabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}{soundEnabled ? "Suono attivo" : "Suono spento"}
            </button>
          </div>
        </div>
        <div className="max-h-[420px] divide-y divide-white/8 overflow-y-auto">
          {items.map((reservation) => {
            const reservationLocation = monitoredLocations.find((item) => item.id === reservation.locationId);
            return <button key={reservation.id} type="button" onClick={() => void openReservation(reservation)} className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto] gap-3 p-4 text-left transition-colors hover:bg-white/[0.035]">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarCheck2 className="size-4" /></span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{reservation.customer.firstName} {reservation.customer.lastName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reservation.partySize} ospiti Â· {reservation.reservationCode}{monitorAllLocations && reservationLocation ? ` Â· ${reservationLocation.shortName}` : ""}</span></span>
              <time className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Clock3 className="size-3" />{formatCreatedAt(reservation.createdAt)}</time>
            </button>;
          })}
          {items.length === 0 && <div className="px-5 py-10 text-center"><Check className="mx-auto size-5 text-emerald-300" /><p className="mt-3 text-sm font-medium">Nessuna notifica recente</p><p className="mt-1 text-xs text-muted-foreground">Le nuove prenotazioni compariranno qui.</p></div>}
        </div>
        <div className="border-t border-white/8 bg-background/30 px-4 py-3 text-[10px] leading-4 text-muted-foreground">{monitorAllLocations ? "Avvisi YUKO e KouSushi in tempo reale." : `Avvisi ${location.shortName} in tempo reale.`} Controllo di sicurezza ogni 15 secondi.</div>
      </PopoverContent>
    </Popover>

    {toast && <div role="status" aria-live="polite" className="surface-3d-dark fixed bottom-5 right-5 z-[90] w-[min(370px,calc(100vw-2.5rem))] overflow-hidden rounded-2xl border border-primary/25 bg-card text-foreground shadow-2xl">
      <div className="service-route h-0.5" />
      <div className="flex items-start gap-3 p-4">
        <span className="signal-pulse flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BellRing className="size-4" /></span>
        <div className="min-w-0 flex-1"><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-primary">Nuova prenotazione Â· {toastLocation?.shortName ?? location.shortName}</p><p className="mt-1 font-medium">{toast.customer.firstName} {toast.customer.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{toast.partySize} ospiti Â· {toast.reservationCode}</p></div>
        <button type="button" onClick={() => setToast(null)} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Chiudi notifica"><X className="size-4" /></button>
      </div>
    </div>}
  </>;
}

function formatCreatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "ora" : new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(date);
}
