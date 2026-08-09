"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  defaultNotificationPreferences,
  legacyNotificationToggleKey,
  notificationPreferencesKey,
  readNotificationPreferences,
  writeNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences";

/**
 * Le preferenze sonore lette come stato esterno, non copiate in uno stato React.
 *
 * `localStorage` è mutabile e condiviso fra le schede: `useSyncExternalStore` è
 * l'API pensata esattamente per questo. Copiarlo in un `useState` dentro un
 * effect sembra più semplice ma introduce due difetti — un primo render con i
 * valori sbagliati, e due schede che divergono finché non si ricarica.
 *
 * Lo scambio fra schede passa dall'evento `storage`; quello dentro la stessa
 * scheda da un evento nostro, perché `storage` non si attiva su chi ha scritto.
 */
const SAME_TAB_EVENT = "regia-sushi:notification-preferences";

// `getSnapshot` deve restituire lo stesso oggetto finché il valore non cambia,
// altrimenti React vede un aggiornamento a ogni render e cicla all'infinito.
const cache = new Map<string, { raw: string | null; value: NotificationPreferences }>();

function snapshot(locationId: string): NotificationPreferences {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(notificationPreferencesKey(locationId));
  const cached = cache.get(locationId);
  if (cached && cached.raw === raw) return cached.value;
  const value = readNotificationPreferences(locationId);
  cache.set(locationId, { raw, value });
  return value;
}

export function useNotificationPreferences(locationId: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === notificationPreferencesKey(locationId) || event.key === legacyNotificationToggleKey(locationId)) onChange();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(SAME_TAB_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SAME_TAB_EVENT, onChange);
    };
  }, [locationId]);

  const preferences = useSyncExternalStore(
    subscribe,
    () => snapshot(locationId),
    () => defaultNotificationPreferences,
  );

  const update = useCallback((changes: Partial<NotificationPreferences>) => {
    const next = { ...snapshot(locationId), ...changes };
    writeNotificationPreferences(locationId, next);
    cache.delete(locationId);
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
    return next;
  }, [locationId]);

  return [preferences, update] as const;
}
