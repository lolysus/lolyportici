"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useReservationRealtime } from "@/hooks/use-reservation-realtime";
import { cn } from "@/lib/utils";

/**
 * Dice come stanno arrivando gli aggiornamenti, non come vorremmo arrivassero.
 *
 * La spinta in tempo reale passa da Supabase Realtime. In produzione Supabase
 * non è configurato, quindi non c'è nessun canale aperto: le prenotazioni nuove
 * si vedono grazie al controllo periodico del centro notifiche. Prima questa
 * situazione veniva etichettata "Demo" su fondo verde, che su un sistema con
 * prenotazioni reali è sia falso sia allarmante.
 */
const STATI = {
  live: {
    label: "Live",
    descrizione: "Aggiornamento immediato: le nuove prenotazioni arrivano appena registrate.",
    punto: "bg-emerald-400",
    box: "bg-emerald-500/10 text-emerald-300",
  },
  polling: {
    label: "Ogni 15 s",
    descrizione: "Le nuove prenotazioni compaiono entro quindici secondi, con avviso sonoro.",
    punto: "bg-sky-400",
    box: "bg-sky-500/10 text-sky-300",
  },
  connecting: {
    label: "Connessione",
    descrizione: "Collegamento in corso.",
    punto: "bg-amber-300 animate-pulse",
    box: "bg-amber-500/10 text-amber-200",
  },
  offline: {
    label: "Offline",
    descrizione: "Aggiornamenti interrotti: ricarica la pagina.",
    punto: "bg-destructive",
    box: "bg-destructive/10 text-destructive",
  },
} as const;

export function RealtimeStatus({ locationId, compact = false }: { locationId: string; compact?: boolean }) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  const status = useReservationRealtime(refresh, { locationId });
  // "demo" significa che non esiste un canale realtime: l'unico aggiornamento
  // effettivo è il controllo periodico, ed è questo che va dichiarato.
  const stato = STATI[status === "demo" ? "polling" : status];

  return <div
    aria-label={`Aggiornamenti: ${stato.label}. ${stato.descrizione}`}
    title={stato.descrizione}
    className={cn("flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs", stato.box, compact && "size-9 justify-center p-0 sm:size-auto sm:px-2.5 sm:py-1.5")}
  >
    <span className={cn("size-1.5 rounded-full", stato.punto)} />
    <span className={cn(compact && "hidden sm:inline")}>{stato.label}</span>
  </div>;
}
