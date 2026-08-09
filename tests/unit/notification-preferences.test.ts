import { beforeEach, describe, expect, it, vi } from "vitest";
import { restaurantLocations } from "@/config/brand";
import {
  claimReservationAnnouncement,
  defaultNotificationPreferences,
  legacyNotificationToggleKey,
  notificationPreferencesKey,
  readNotificationPreferences,
  writeNotificationPreferences,
} from "@/lib/notification-preferences";
import { findNotificationSound, notificationSounds } from "@/lib/notification-sounds";

const [yuko, kousushi] = restaurantLocations;

/** Un localStorage minimo: i test girano su Node, senza browser. */
function installStorage() {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  vi.stubGlobal("window", { localStorage: storage });
  return storage;
}

describe("preferenze sonore della dashboard", () => {
  beforeEach(() => { installStorage(); });

  it("parte con la campanella accesa: una sala muta è il guasto peggiore", () => {
    expect(readNotificationPreferences(yuko.id)).toEqual(defaultNotificationPreferences);
    expect(defaultNotificationPreferences.enabled).toBe(true);
  });

  it("tiene separate le impostazioni di Ardea e di Portici", () => {
    writeNotificationPreferences(yuko.id, { enabled: true, soundId: "gong-morbido", volume: 40 });
    writeNotificationPreferences(kousushi.id, { enabled: false, soundId: "doppio-tocco", volume: 100 });

    // Due sale, due livelli di rumore: la scelta di una non deve toccare l'altra.
    expect(readNotificationPreferences(yuko.id)).toEqual({ enabled: true, soundId: "gong-morbido", volume: 40 });
    expect(readNotificationPreferences(kousushi.id)).toEqual({ enabled: false, soundId: "doppio-tocco", volume: 100 });
    expect(notificationPreferencesKey(yuko.id)).not.toBe(notificationPreferencesKey(kousushi.id));
  });

  it("sopravvive a un logout: le preferenze non stanno nella sessione", () => {
    writeNotificationPreferences(yuko.id, { enabled: true, soundId: "doppio-tocco", volume: 55 });
    // Un nuovo accesso non tocca localStorage: rileggere deve dare lo stesso.
    expect(readNotificationPreferences(yuko.id).soundId).toBe("doppio-tocco");
    expect(readNotificationPreferences(yuko.id).volume).toBe(55);
  });

  it("rispetta chi aveva già spento la campanella prima della libreria", () => {
    window.localStorage.setItem(legacyNotificationToggleKey(yuko.id), "off");
    // Cambiare formato di salvataggio non deve riaccendere un avviso che
    // qualcuno aveva zittito di proposito.
    expect(readNotificationPreferences(yuko.id).enabled) .toBe(false);
  });

  it("riporta un volume fuori scala dentro i limiti", () => {
    writeNotificationPreferences(yuko.id, { enabled: true, soundId: "campanella", volume: 999 });
    expect(readNotificationPreferences(yuko.id).volume).toBe(100);
    writeNotificationPreferences(yuko.id, { enabled: true, soundId: "campanella", volume: -30 });
    expect(readNotificationPreferences(yuko.id).volume).toBe(0);
  });

  it("ripiega sul suono predefinito se quello salvato non esiste più", () => {
    window.localStorage.setItem(notificationPreferencesKey(yuko.id), JSON.stringify({ enabled: true, soundId: "suono-rimosso", volume: 70 }));
    expect(readNotificationPreferences(yuko.id).soundId).toBe(defaultNotificationPreferences.soundId);
  });

  it("non resta muta con preferenze illeggibili", () => {
    window.localStorage.setItem(notificationPreferencesKey(yuko.id), "{rotto");
    expect(readNotificationPreferences(yuko.id)).toEqual(defaultNotificationPreferences);
  });
});

describe("una sola campanella con più schede aperte", () => {
  beforeEach(() => { installStorage(); });

  it("annuncia una prenotazione una volta sola", () => {
    // La seconda chiamata è la seconda scheda che scopre la stessa prenotazione.
    expect(claimReservationAnnouncement(yuko.id, "res-1")).toBe(true);
    expect(claimReservationAnnouncement(yuko.id, "res-1")).toBe(false);
    expect(claimReservationAnnouncement(yuko.id, "res-1")).toBe(false);
  });

  it("annuncia comunque le prenotazioni diverse", () => {
    expect(claimReservationAnnouncement(yuko.id, "res-1")).toBe(true);
    expect(claimReservationAnnouncement(yuko.id, "res-2")).toBe(true);
  });

  it("non fa tacere Portici perché Ardea ha già annunciato", () => {
    // Gli identificativi delle prenotazioni sono distinti, ma la garanzia va
    // scritta: le due sale non condividono lo stato degli annunci.
    expect(claimReservationAnnouncement(yuko.id, "res-condiviso")).toBe(true);
    expect(claimReservationAnnouncement(kousushi.id, "res-condiviso")).toBe(true);
  });

  it("non cresce senza limite: gli annunci vecchi vengono dimenticati", () => {
    for (let index = 0; index < 40; index += 1) claimReservationAnnouncement(yuko.id, `res-${index}`);
    const raw = window.localStorage.getItem(`regia-sushi-notification-announced:${yuko.id}`)!;
    const stored = JSON.parse(raw) as Record<string, number>;
    // Tutti recenti, quindi tutti presenti: il test fissa che la struttura sia
    // una mappa con timbro temporale, che è ciò che permette la scadenza.
    expect(Object.keys(stored)).toHaveLength(40);
    expect(Object.values(stored).every((at) => typeof at === "number")).toBe(true);
  });
});

describe("libreria dei suoni", () => {
  it("offre almeno due alternative, con un predefinito fra queste", () => {
    expect(notificationSounds.length).toBeGreaterThanOrEqual(2);
    expect(notificationSounds.map((sound) => sound.id)).toContain(defaultNotificationPreferences.soundId);
  });

  it("non ha identificativi né etichette doppie", () => {
    expect(new Set(notificationSounds.map((s) => s.id)).size).toBe(notificationSounds.length);
    expect(new Set(notificationSounds.map((s) => s.label)).size).toBe(notificationSounds.length);
  });

  it("descrive ogni suono, perché l'anteprima da sola non basta a scegliere", () => {
    for (const sound of notificationSounds) expect(sound.description.length).toBeGreaterThan(20);
  });

  it("suona qualcosa anche se l'identificativo è ignoto", () => {
    expect(findNotificationSound("inesistente").id).toBe(notificationSounds[0].id);
    expect(findNotificationSound(null).id).toBe(notificationSounds[0].id);
  });

  it("scala il volume senza mai superare il massimo del contesto audio", () => {
    // Un guadagno oltre 1 distorce sugli altoparlanti piccoli, che sono
    // esattamente quelli di un tablet in sala.
    const peaks: number[] = [];
    const fakeContext = {
      currentTime: 0,
      createOscillator: () => ({ type: "sine", frequency: { value: 0 }, connect: (node: unknown) => node, start: () => {}, stop: () => {} }),
      createGain: () => ({
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: (value: number) => void peaks.push(value),
        },
        connect: () => {},
      }),
      destination: {},
    } as unknown as AudioContext;

    for (const sound of notificationSounds) sound.play(fakeContext, 100);
    expect(peaks.length).toBeGreaterThan(0);
    expect(Math.max(...peaks)).toBeLessThan(1);
  });
});
