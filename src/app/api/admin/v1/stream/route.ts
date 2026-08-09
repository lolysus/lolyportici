import { requirePermission } from "@/lib/auth/dal";
import { getAdminLocationFromRequest } from "@/lib/admin/location";
import { failure } from "@/lib/api/response";
import { subscribeToReservationChanges, type ReservationChange } from "@/lib/realtime/reservation-hub";

/**
 * Il flusso degli eventi che la dashboard ascolta invece di chiedere.
 *
 * Server-Sent Events e non WebSocket: il traffico va in una sola direzione — il
 * database parla, la dashboard ascolta — e SSE passa da un normale `GET`, quindi
 * attraversa la riscrittura di Vercel verso Railway senza niente di speciale.
 * Un WebSocket avrebbe richiesto un canale a parte e non avrebbe aggiunto nulla.
 *
 * La sede **non** arriva dal client: viene dalla sessione, come per ogni altra
 * API di gestione. Chi è di Portici riceve solo Portici, anche cambiando
 * l'indirizzo a mano.
 */

export const dynamic = "force-dynamic";

/** Sotto i trenta secondi di silenzio molti proxy chiudono la connessione. */
const HEARTBEAT_MS = 20_000;

export async function GET(request: Request) {
  try {
    const session = await requirePermission("reservations:read");
    const location = getAdminLocationFromRequest(request, session);

    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Il client se n'è andato mentre scrivevamo: `cancel` farà pulizia.
          }
        };

        unsubscribe = subscribeToReservationChanges(location.id, (change: ReservationChange) => {
          send("reservation", change);
        });

        // Il client deve sapere subito se questo canale è vivo: se qui non c'è
        // database, resterebbe in ascolto di un silenzio permanente invece di
        // tornare a interrogare.
        send("ready", { live: unsubscribe !== null, restaurant: location.slug });

        heartbeat = setInterval(() => {
          // Un commento SSE: tiene aperta la connessione senza essere un evento
          // che il client debba interpretare.
          try { controller.enqueue(encoder.encode(": battito\n\n")); } catch { /* chiuso */ }
        }, HEARTBEAT_MS);

        if (!unsubscribe) {
          if (heartbeat) clearInterval(heartbeat);
          controller.close();
        }
      },
      cancel() {
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        // Alcuni proxy accumulano la risposta prima di inoltrarla, e un flusso
        // accumulato non è un flusso: questa intestazione glielo vieta.
        "x-accel-buffering": "no",
      },
    });
  } catch (error) { return failure(error); }
}
