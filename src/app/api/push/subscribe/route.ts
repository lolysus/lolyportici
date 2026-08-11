import { z } from "zod";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { savePushSubscription } from "@/lib/push/web-push-service";

/**
 * Registra il dispositivo di uno del personale per le notifiche push.
 *
 * L'iscrizione è legata alla **sede della sessione**, non a un valore mandato
 * dal client: le notifiche contengono nomi di clienti, quindi solo chi è entrato
 * nel pannello di quella sede può iscriversi a riceverle. Chi lavora a Portici
 * non può, cambiando il corpo della richiesta, mettersi ad ascoltare Ardea.
 */
const subscribeSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
  userAgent: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await requirePermission("reservations:read");
    const parsed = subscribeSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    await savePushSubscription(session.locationId, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: parsed.data.userAgent,
    });
    return success({ subscribed: true }, { status: 201 });
  } catch (error) { return failure(error); }
}
