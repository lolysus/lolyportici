import "server-only";

import { getPostgres, isPostgresConfigured } from "@/lib/postgres";

/**
 * Un solo ascolto sul database, tante dashboard.
 *
 * `sql.listen()` apre una connessione dedicata a ogni chiamata: se ogni scheda
 * aperta del pannello ne aprisse una, dieci tablet in due sale farebbero dieci
 * connessioni ferme in attesa, e il conto cresce con le persone che lavorano.
 *
 * Qui la connessione è **una per processo**, e chi arriva si iscrive a un
 * elenco in memoria. Nasce alla prima iscrizione e muore quando l'ultimo se ne
 * va, così un backend senza nessuno collegato non tiene niente aperto.
 */

export interface ReservationChange {
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  locationId: string;
  code: string;
  status: string;
  date: string;
}

type Subscriber = (change: ReservationChange) => void;

interface Hub {
  subscribers: Map<string, Set<Subscriber>>;
  listening: Promise<{ unlisten: () => Promise<void> }> | null;
}

// Sul globale: in sviluppo Next ricarica i moduli a ogni modifica, e un hub
// per ricarica lascerebbe connessioni orfane in ascolto.
const globalHub = globalThis as typeof globalThis & { __lolyReservationHub?: Hub };

function hub(): Hub {
  globalHub.__lolyReservationHub ??= { subscribers: new Map(), listening: null };
  return globalHub.__lolyReservationHub;
}

function totalSubscribers(current: Hub) {
  let total = 0;
  for (const set of current.subscribers.values()) total += set.size;
  return total;
}

function dispatch(payload: string) {
  const current = hub();
  let change: ReservationChange;
  try {
    change = JSON.parse(payload) as ReservationChange;
  } catch {
    // Un messaggio illeggibile non deve far cadere l'ascolto di tutti.
    console.error("[realtime] payload di reservation_changed illeggibile");
    return;
  }
  // Solo la sede interessata: una prenotazione di Portici non deve nemmeno
  // sfiorare la dashboard di Ardea.
  for (const subscriber of current.subscribers.get(change.locationId) ?? []) {
    try {
      subscriber(change);
    } catch (error) {
      console.error("[realtime] un iscritto ha sollevato un errore", error);
    }
  }
}

/**
 * Si iscrive ai cambiamenti di una sede. Ritorna la funzione per disiscriversi.
 *
 * `null` significa "non c'è database qui": succede dove l'app gira senza
 * `DATABASE_URL`, e chi chiama deve ripiegare sull'interrogazione periodica
 * invece di restare in silenzio a credere di essere collegato.
 */
export function subscribeToReservationChanges(locationId: string, subscriber: Subscriber): (() => void) | null {
  if (!isPostgresConfigured()) return null;
  const current = hub();
  const forLocation = current.subscribers.get(locationId) ?? new Set<Subscriber>();
  forLocation.add(subscriber);
  current.subscribers.set(locationId, forLocation);

  current.listening ??= getPostgres().listen("reservation_changed", dispatch).catch((error) => {
    console.error("[realtime] ascolto di reservation_changed non riuscito", error);
    current.listening = null;
    throw error;
  });
  // Se l'ascolto non parte, chi si è iscritto lo scopre e ripiega: meglio di una
  // dashboard convinta di essere in ascolto e ferma.
  void current.listening.catch(() => undefined);

  return () => {
    forLocation.delete(subscriber);
    if (forLocation.size === 0) current.subscribers.delete(locationId);
    if (totalSubscribers(current) === 0 && current.listening) {
      const pending = current.listening;
      current.listening = null;
      void pending.then((handle) => handle.unlisten()).catch(() => undefined);
    }
  };
}

/** Vero se l'ascolto è possibile: serve a dire al client se aspettarsi eventi. */
export function reservationStreamAvailable() {
  return isPostgresConfigured();
}
