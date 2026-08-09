"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { RestaurantLocation } from "@/config/brand";
import { useNotificationPreferences } from "@/hooks/use-notification-preferences";
import { defaultNotificationPreferences, type NotificationPreferences } from "@/lib/notification-preferences";
import { findNotificationSound, notificationSounds } from "@/lib/notification-sounds";
import { cn } from "@/lib/utils";

type AudioWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

/**
 * Le impostazioni della campanella, dove le cerca chi le vuole cambiare.
 *
 * Valgono **per questa sede e per questo dispositivo**: è il dispositivo a fare
 * il rumore, e il tablet in sala non ha le stesse esigenze del portatile in
 * ufficio. Detto in chiaro nell'interfaccia, perché altrimenti un titolare
 * cambia suono sul telefono e si aspetta di sentirlo anche al leggio.
 */
export function NotificationSoundSettings({ location }: { location: RestaurantLocation }) {
  const [preferences, updatePreferences] = useNotificationPreferences(location.id);
  // Il cursore del volume si muove in continuo: lo stato locale segue il dito,
  // il salvataggio arriva al rilascio.
  const [draftVolume, setDraftVolume] = useState<number | null>(null);
  const volume = draftVolume ?? preferences.volume;
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => () => {
    const context = audioContext.current;
    audioContext.current = null;
    void context?.close();
  }, []);

  const preview = useCallback(async (soundId: string, volume: number) => {
    const AudioContextClass = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextClass) { setAudioBlocked(true); return; }
    if (audioContext.current?.state === "closed") audioContext.current = null;
    const context = audioContext.current ?? new AudioContextClass();
    audioContext.current = context;
    try {
      await context.resume();
      if (context.state !== "running") { setAudioBlocked(true); return; }
      setAudioBlocked(false);
      findNotificationSound(soundId).play(context, volume);
    } catch {
      setAudioBlocked(true);
    }
  }, []);

  function update(changes: Partial<NotificationPreferences>, options: { previewSound?: boolean } = {}) {
    const next = updatePreferences(changes);
    setDraftVolume(null);
    setSavedAt(Date.now());
    // L'anteprima parte dal clic dell'utente, che è ciò che i browser
    // pretendono per sbloccare l'audio: farla qui è anche il modo di scoprire
    // subito se questa dashboard è ancora muta.
    if (options.previewSound && next.enabled) void preview(next.soundId, next.volume);
  }

  function restoreDefaults() {
    updatePreferences(defaultNotificationPreferences);
    setDraftVolume(null);
    setSavedAt(Date.now());
    void preview(defaultNotificationPreferences.soundId, defaultNotificationPreferences.volume);
  }

  const isDefault = preferences.soundId === defaultNotificationPreferences.soundId
    && volume === defaultNotificationPreferences.volume
    && preferences.enabled === defaultNotificationPreferences.enabled;

  return <section className="surface-3d rounded-2xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 font-heading text-2xl"><BellRing className="size-5 text-primary" />Notifiche sonore</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Il suono che avvisa di una nuova prenotazione di {location.shortName}. Vale per <strong>questo dispositivo</strong>:
          il tablet in sala e il portatile in ufficio possono avere volumi diversi, ed è quello che serve.
        </p>
      </div>
      <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", preferences.enabled ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700" : "border-border bg-muted text-muted-foreground")}>
        {preferences.enabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
        {preferences.enabled ? "Attive" : "Disattivate"}
      </span>
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      <Button variant={preferences.enabled ? "outline" : "default"} onClick={() => update({ enabled: !preferences.enabled }, { previewSound: !preferences.enabled })} className="min-h-11" aria-pressed={preferences.enabled}>
        {preferences.enabled ? <VolumeX /> : <Volume2 />}{preferences.enabled ? "Disattiva notifiche sonore" : "Attiva notifiche sonore"}
      </Button>
      <Button variant="outline" onClick={() => void preview(preferences.soundId, volume)} disabled={!preferences.enabled} className="min-h-11">
        <Bell />Prova la notifica
      </Button>
      <Button variant="ghost" onClick={restoreDefaults} disabled={isDefault} className="min-h-11">
        <RotateCcw />Ripristina il suono predefinito
      </Button>
    </div>

    {audioBlocked && <p role="alert" className="mt-4 rounded-xl border border-amber-400/35 bg-amber-400/10 p-3 text-sm text-amber-800">
      Il browser tiene l’audio bloccato finché non interagisci con la pagina. Premi “Prova la notifica”: da quel momento la campanella funziona per tutta la sessione.
    </p>}

    <fieldset className="mt-6" disabled={!preferences.enabled}>
      <legend className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Suono</legend>
      <ul role="list" className="grid gap-2.5 sm:grid-cols-3">
        {notificationSounds.map((sound) => {
          const active = preferences.soundId === sound.id;
          return <li key={sound.id}>
            <div className={cn("flex h-full flex-col rounded-xl border p-4 transition-colors", active ? "border-primary bg-primary/[0.06] ring-2 ring-primary/20" : "bg-background", !preferences.enabled && "opacity-55")}>
              <button type="button" onClick={() => update({ soundId: sound.id }, { previewSound: true })} aria-pressed={active} className="min-h-11 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-center justify-between gap-2"><span className="font-semibold">{sound.label}</span>{active && <Check className="size-4 shrink-0 text-primary" />}</span>
                <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">{sound.description}</span>
              </button>
              <button type="button" onClick={() => void preview(sound.id, volume)} disabled={!preferences.enabled} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border bg-card px-3 text-xs font-semibold transition-colors hover:border-primary/40 disabled:opacity-50">
                <Play className="size-3.5" />Ascolta
              </button>
            </div>
          </li>;
        })}
      </ul>

      <div className="mt-6 max-w-md">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="notification-volume">Volume</Label>
          <span className="font-mono text-sm text-muted-foreground">{volume}%</span>
        </div>
        <input
          id="notification-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          onChange={(event) => setDraftVolume(Number(event.target.value))}
          // Il salvataggio e l'anteprima al rilascio, non a ogni pixel: durante
          // il trascinamento partirebbero venti campanelle sovrapposte.
          onPointerUp={() => update({ volume }, { previewSound: true })}
          onKeyUp={() => update({ volume }, { previewSound: true })}
          disabled={!preferences.enabled}
          className="mt-3 h-11 w-full touch-manipulation accent-[var(--primary)]"
          aria-describedby="notification-volume-hint"
        />
        <p id="notification-volume-hint" className="mt-1 text-xs text-muted-foreground">Con la sala piena serve almeno l’80%.</p>
      </div>
    </fieldset>

    <p className="mt-6 text-xs text-muted-foreground" aria-live="polite">
      {savedAt ? `Preferenze salvate su questo dispositivo alle ${new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(savedAt)}.`
        : "Le modifiche si salvano da sole su questo dispositivo."}
    </p>
  </section>;
}
