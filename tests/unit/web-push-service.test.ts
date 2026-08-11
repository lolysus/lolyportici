import { afterEach, beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";
import { pushConfigured, sendPushToLocation, savePushSubscription, vapidPublicKey } from "@/lib/push/web-push-service";

// Chiavi VAPID vere (formato valido) per esercitare il ramo "configurata".
const realKeys = webpush.generateVAPIDKeys();

/**
 * La push non deve mai far cadere una prenotazione. Senza chiavi VAPID o senza
 * database, ogni funzione qui deve degradare a un no-op silenzioso invece di
 * sollevare: è la garanzia che l'hook nel flusso di prenotazione sia innocuo.
 */
describe("web push service — degrado sicuro", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PUBLIC_URL;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("si dichiara non configurata senza chiavi VAPID", () => {
    expect(pushConfigured()).toBe(false);
    expect(vapidPublicKey()).toBeNull();
  });

  it("espone la chiave pubblica quando configurata", () => {
    process.env.VAPID_PUBLIC_KEY = `  ${realKeys.publicKey}  `;
    expect(pushConfigured()).toBe(false); // manca ancora la privata
    process.env.VAPID_PRIVATE_KEY = realKeys.privateKey;
    expect(pushConfigured()).toBe(true);
    // La chiave torna ripulita dagli spazi, pronta per il browser.
    expect(vapidPublicKey()).toBe(realKeys.publicKey);
  });

  it("non invia nulla senza database, senza sollevare", async () => {
    process.env.VAPID_PUBLIC_KEY = realKeys.publicKey;
    process.env.VAPID_PRIVATE_KEY = realKeys.privateKey;
    const result = await sendPushToLocation("00000000-0000-0000-0000-000000000003", {
      title: "x", body: "y", url: "/",
    });
    expect(result).toEqual({ sent: 0, pruned: 0 });
  });

  it("non salva l'iscrizione senza database, senza sollevare", async () => {
    await expect(savePushSubscription("00000000-0000-0000-0000-000000000003", {
      endpoint: "https://push.example/abc", p256dh: "k", auth: "a",
    })).resolves.toBeUndefined();
  });
});
