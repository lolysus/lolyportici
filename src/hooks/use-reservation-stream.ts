"use client";

import { useEffect, useRef, useState } from "react";

export interface ReservationStreamEvent {
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  locationId: string;
  code: string;
  status: string;
  date: string;
}

export type StreamState = "connecting" | "live" | "polling";

/**
 * Le prenotazioni che arrivano da sole, senza chiederle.
 *
 * Il canale è `/api/admin/v1/stream`, che a sua volta ascolta il database. La
 * sede la decide il server dalla sessione: qui non si manda e non si può
 * scegliere.
 *
 * L'interrogazione periodica **non sparisce**, cambia ruolo: da unico mezzo
 * diventa la rete di sicurezza. Finché il flusso è vivo basta un giro lento
 * ogni due minuti — perché un evento perso durante una riconnessione non deve
 * restare perso — e se il flusso cade si torna a chiedere ogni quindici
 * secondi, cioè al comportamento di prima, che almeno funziona.
 *
 * `onEvent` viene chiamata a ogni cambiamento; `onPoll` al giro di sicurezza.
 */
export function useReservationStream(
  onEvent: (event: ReservationStreamEvent) => void,
  onPoll: () => void,
): StreamState {
  const [state, setState] = useState<StreamState>("connecting");
  // I riferimenti evitano di ricostruire la connessione a ogni render solo
  // perché la funzione passata è una nuova chiusura. L'assegnazione sta in un
  // effetto: durante il render i riferimenti non si toccano.
  const eventRef = useRef(onEvent);
  const pollRef = useRef(onPoll);
  useEffect(() => {
    eventRef.current = onEvent;
    pollRef.current = onPoll;
  });

  useEffect(() => {
    // Senza EventSource lo stato resta "connecting", che per il giro di
    // sicurezza vale come "non in diretta": si interroga ogni quindici secondi,
    // cioè il comportamento di prima. Nessun `setState` qui, perché farlo in
    // modo sincrono dentro un effetto innesca render a cascata.
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/admin/v1/stream");

      source.addEventListener("ready", (message) => {
        attempts = 0;
        try {
          const payload = JSON.parse((message as MessageEvent<string>).data) as { live: boolean };
          setState(payload.live ? "live" : "polling");
        } catch {
          setState("live");
        }
      });

      source.addEventListener("reservation", (message) => {
        try {
          eventRef.current(JSON.parse((message as MessageEvent<string>).data) as ReservationStreamEvent);
        } catch {
          // Evento illeggibile: meglio un giro di controllo che ignorarlo.
          pollRef.current();
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;
        setState("polling");
        if (closed) return;
        // Attesa che cresce: una rete che va e viene non deve diventare una
        // raffica di riconnessioni, ma dopo mezzo minuto si riprova comunque.
        attempts += 1;
        const wait = Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5));
        retry = setTimeout(() => {
          // Alla riconnessione si rilegge tutto: nel buco possono essere
          // arrivate prenotazioni che nessun evento racconterà più.
          pollRef.current();
          connect();
        }, wait);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  // La rete di sicurezza, con il passo che dipende da come sta il canale.
  useEffect(() => {
    const every = state === "live" ? 120_000 : 15_000;
    const timer = window.setInterval(() => pollRef.current(), every);
    return () => window.clearInterval(timer);
  }, [state]);

  return state;
}
