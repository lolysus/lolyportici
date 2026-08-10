"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useReservationStream } from "@/hooks/use-reservation-stream";
import { cn } from "@/lib/utils";

/**
 * Dice come stanno arrivando gli aggiornamenti, non come vorremmo arrivassero.
 *
 * Prima guardava Supabase Realtime, che in produzione non è configurato: il
 * badge dichiarava "Ogni 15 s" perché quello era davvero l'unico aggiornamento.
 * Da quando esiste il canale sul database, quella etichetta è diventata falsa
 * nell'altro verso — gli eventi arrivano in poco più di un decimo di secondo — e
 * un indicatore che sottostima è comunque un indicatore che mente.
 *
 * Vive nell'intestazione, quindi su **ogni** pagina del pannello, e questo gli dà
 * un secondo compito: a ogni evento chiama `router.refresh()`, così anche le
 * schermate che non gestiscono un proprio aggiornamento — sala e tavoli, ospiti,
 * lista d'attesa — smettono di richiedere un ricaricamento a mano. Apre una
 * propria connessione, distinta da quella del centro notifiche: quella serve al
 * suono, questa ai dati della pagina.
 */
const STATI = {
  live: {
    label: "In diretta",
    descrizione: "Il database avvisa: le nuove prenotazioni compaiono in meno di un secondo.",
    punto: "bg-emerald-400",
    box: "bg-emerald-500/10 text-emerald-300",
  },
  polling: {
    label: "Ogni 15 s",
    descrizione: "Canale in diretta non disponibile: le nuove prenotazioni compaiono entro quindici secondi.",
    punto: "bg-sky-400",
    box: "bg-sky-500/10 text-sky-300",
  },
  connecting: {
    label: "Connessione",
    descrizione: "Collegamento al canale in corso; nel frattempo il controllo periodico è attivo.",
    punto: "bg-amber-300 animate-pulse",
    box: "bg-amber-500/10 text-amber-200",
  },
} as const;

export function RealtimeStatus({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const aggiorna = useCallback(() => router.refresh(), [router]);
  const stato = STATI[useReservationStream(aggiorna, aggiorna)];

  return <div
    aria-label={`Aggiornamenti: ${stato.label}. ${stato.descrizione}`}
    title={stato.descrizione}
    className={cn("flex items-center gap-2 rounded-full px-2.5 py-1.5 text-xs", stato.box, compact && "size-9 justify-center p-0 sm:size-auto sm:px-2.5 sm:py-1.5")}
  >
    <span aria-hidden className={cn("size-1.5 rounded-full", stato.punto)} />
    <span className={cn(compact && "hidden sm:inline")}>{stato.label}</span>
  </div>;
}
