import { defaultNotificationSoundId, findNotificationSound } from "@/lib/notification-sounds";

/**
 * Le preferenze sonore della dashboard: per sede e per dispositivo.
 *
 * **Per sede** perché Ardea e Portici sono due sale diverse, con rumore diverso:
 * chi lavora in una non deve subire la scelta dell'altra. **Per dispositivo**
 * perché è il dispositivo a fare il rumore — il tablet al leggio vuole il volume
 * alto, il portatile in ufficio no, e sono la stessa persona.
 *
 * Per questo vivono in `localStorage` e non nelle impostazioni del ristorante
 * salvate sul server: quelle sono uguali per tutti i dispositivi, e sarebbe la
 * cosa sbagliata.
 *
 * **Non c'è più un interruttore per spegnere la campanella.** C'era, ed era il
 * modo più facile di perdere una prenotazione: basta che qualcuno la zittisca
 * durante un turno tranquillo perché resti muta per sempre su quel tablet,
 * senza che nessun altro se ne accorga. Restano il suono e il volume — chi
 * lavora in sala sceglie *come* la sente, non *se* la sente.
 */

export interface NotificationPreferences {
  soundId: string;
  /** 0–100, come lo legge chi muove il cursore. */
  volume: number;
}

export const defaultNotificationPreferences: NotificationPreferences = {
  soundId: defaultNotificationSoundId,
  volume: 80,
};

function preferencesKey(locationId: string) {
  return `regia-sushi-notification-preferences:${locationId}`;
}

export function notificationPreferencesKey(locationId: string) {
  return preferencesKey(locationId);
}

export function readNotificationPreferences(locationId: string): NotificationPreferences {
  if (typeof window === "undefined") return defaultNotificationPreferences;
  try {
    const raw = window.localStorage.getItem(preferencesKey(locationId));
    if (!raw) return defaultNotificationPreferences;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      soundId: findNotificationSound(parsed.soundId).id,
      volume: clampVolume(parsed.volume),
    };
  } catch {
    // Preferenze illeggibili non devono far restare muta la dashboard: il
    // default è "suona", che è il male minore fra i due errori possibili.
    return defaultNotificationPreferences;
  }
}

export function writeNotificationPreferences(locationId: string, preferences: NotificationPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(preferencesKey(locationId), JSON.stringify(preferences));
  } catch {
    // Con lo storage non disponibile la scelta vale per questa sessione e basta.
  }
}

/**
 * Il volume più basso ammesso.
 *
 * Zero non è un volume, è l'interruttore di spegnimento sotto un altro nome: e
 * quello è stato tolto di proposito. Dieci è poco, ma si sente.
 */
export const minimumNotificationVolume = 10;

function clampVolume(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return defaultNotificationPreferences.volume;
  return Math.min(100, Math.max(minimumNotificationVolume, Math.round(numeric)));
}

/* ── Una sola campanella con più schede aperte ─────────────────────────────── */

function announcedKey(locationId: string) {
  return `regia-sushi-notification-announced:${locationId}`;
}

/** Oltre questo tempo un annuncio è vecchio e non serve più ricordarlo. */
const ANNOUNCE_TTL_MS = 120_000;

/**
 * Chiede il diritto di annunciare questa prenotazione.
 *
 * Con tre schede del pannello aperte, ognuna scopre la stessa prenotazione al
 * proprio giro e suonerebbe: tre campanelle per un tavolo. Qui la prima che
 * arriva scrive il proprio timbro in `localStorage`, che è condiviso fra le
 * schede della stessa origine, e le altre trovano il posto occupato e restano
 * zitte.
 *
 * Non è un lucchetto: due schede possono leggere nello stesso istante e suonare
 * entrambe. È accettabile — l'alternativa sarebbe eleggere una scheda "padrona",
 * e quando quella viene chiusa nessuno suona più, che è un guasto peggiore di un
 * doppio din.
 *
 * Ritorna `false` anche quando lo storage non è disponibile? No: in quel caso
 * ritorna `true`. Meglio un avviso in più che una prenotazione muta.
 */
export function claimReservationAnnouncement(locationId: string, reservationId: string) {
  if (typeof window === "undefined") return false;
  const key = announcedKey(locationId);
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(key);
    const seen = raw ? JSON.parse(raw) as Record<string, number> : {};
    if (typeof seen[reservationId] === "number" && now - seen[reservationId] < ANNOUNCE_TTL_MS) return false;

    const fresh: Record<string, number> = { [reservationId]: now };
    for (const [id, at] of Object.entries(seen)) {
      if (id !== reservationId && now - at < ANNOUNCE_TTL_MS) fresh[id] = at;
    }
    window.localStorage.setItem(key, JSON.stringify(fresh));
    return true;
  } catch {
    return true;
  }
}
