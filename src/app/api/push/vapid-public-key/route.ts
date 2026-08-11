import { success } from "@/lib/api/response";
import { vapidPublicKey } from "@/lib/push/web-push-service";

/**
 * La chiave pubblica VAPID, con cui il browser si iscrive alle push.
 *
 * È pubblica per definizione — finisce comunque nel browser di chi si iscrive —
 * quindi non serve autenticazione. Vive dietro un endpoint invece che dentro il
 * bundle così la sorgente resta una sola (le variabili d'ambiente del backend) e
 * non va replicata anche nella build del frontend.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return success({ publicKey: vapidPublicKey() });
}
