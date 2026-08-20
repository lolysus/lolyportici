import "server-only";

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { getPostgres, isPostgresConfigured } from "@/lib/postgres";

/**
 * Le notifiche push del personale: iscrizione, invio, pulizia.
 *
 * Gira dove girano le `/api/*` — su Railway, che ha `DATABASE_URL` e un
 * processo che vive a lungo. Su Vercel, dove `DATABASE_URL` non c'è, ogni
 * funzione qui degrada a un no-op silenzioso invece di sollevare: una
 * prenotazione non deve fallire perché la push non è configurata.
 *
 * Le chiavi VAPID identificano il mittente delle push. La pubblica finisce nel
 * browser (per iscriversi), la privata resta solo qui e firma ogni invio.
 */

let vapidReady = false;

function configureVapid() {
  if (vapidReady) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return false;
  // Il "subject" è un contatto che il servizio push può usare per segnalarci un
  // problema: deve essere un mailto: o un URL, non un valore qualsiasi.
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:digitalizzato.ai@gmail.com";
  try {
    // `setVapidDetails` valida il formato delle chiavi e solleva se sono
    // malformate: una chiave sbagliata deve spegnere le push, non far cadere
    // ogni prenotazione che prova a inviarne una.
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
    return true;
  } catch (error) {
    console.error("[push] chiavi VAPID non valide: notifiche disattivate", error);
    return false;
  }
}

export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** La chiave pubblica che il browser usa per iscriversi. `null` se non configurata. */
export function vapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export interface StaffPushPayload {
  title: string;
  body: string;
  /** Dove portare lo staff al tocco della notifica (percorso interno). */
  url: string;
  /** Raggruppa/aggiorna le notifiche dello stesso evento invece di impilarle. */
  tag?: string;
  /** L'icona della sede, così la notifica ha il colore giusto in cima. */
  icon?: string;
  /** Quando è nato l'evento (ms epoch): il telefono mostra l'ora giusta. */
  timestamp?: number;
}

export async function savePushSubscription(locationId: string, input: PushSubscriptionInput) {
  if (!isPostgresConfigured()) return;
  const sql = getPostgres();
  // Lo stesso endpoint che si ripresenta aggiorna la riga: chiavi rinnovate,
  // sede eventualmente cambiata, e nessun doppione che moltiplichi le notifiche.
  await sql`
    insert into public.push_subscriptions (location_id, endpoint, p256dh, auth, user_agent)
    values (${locationId}, ${input.endpoint}, ${input.p256dh}, ${input.auth}, ${input.userAgent ?? null})
    on conflict (endpoint) do update set
      location_id = excluded.location_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      last_seen_at = now()`;
}

export async function deletePushSubscription(endpoint: string) {
  if (!isPostgresConfigured()) return;
  const sql = getPostgres();
  await sql`delete from public.push_subscriptions where endpoint = ${endpoint}`;
}

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

/**
 * Spedisce una notifica a tutti i dispositivi iscritti di una sede.
 *
 * Gli invii partono in parallelo e i fallimenti non si contagiano: un telefono
 * spento non impedisce agli altri di squillare. Un endpoint che il servizio
 * push dichiara morto (404/410) viene rimosso lì per lì, così l'elenco non si
 * riempie di iscrizioni fantasma che rallentano ogni invio successivo.
 */
export async function sendPushToLocation(locationId: string, payload: StaffPushPayload) {
  if (!configureVapid() || !isPostgresConfigured()) return { sent: 0, pruned: 0 };
  const sql = getPostgres();
  const rows = await sql<SubscriptionRow[]>`
    select id, endpoint, p256dh, auth
    from public.push_subscriptions
    where location_id = ${locationId}`;
  if (rows.length === 0) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let pruned = 0;

  await Promise.allSettled(rows.map(async (row) => {
    const subscription: WebPushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    try {
      await webpush.sendNotification(subscription, body, { TTL: 3600, urgency: "high" });
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await sql`delete from public.push_subscriptions where id = ${row.id}`.catch(() => undefined);
        pruned += 1;
      } else {
        console.error("[push] invio non riuscito", { statusCode, endpoint: row.endpoint.slice(0, 40) });
      }
    }
  }));

  return { sent, pruned };
}
