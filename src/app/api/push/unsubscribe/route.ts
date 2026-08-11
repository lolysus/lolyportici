import { z } from "zod";
import { assertSameOrigin, failure, success, validationFailure } from "@/lib/api/response";
import { requirePermission } from "@/lib/auth/dal";
import { deletePushSubscription } from "@/lib/push/web-push-service";

/**
 * Spegne le notifiche su questo dispositivo, cancellando l'iscrizione.
 *
 * L'endpoint identifica il dispositivo per intero e non è indovinabile, quindi
 * basta esso a individuare la riga. Resta comunque dietro l'autenticazione: solo
 * chi è entrato può disiscrivere.
 */
const unsubscribeSchema = z.object({ endpoint: z.string().url().max(1000) });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requirePermission("reservations:read");
    const parsed = unsubscribeSchema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());
    await deletePushSubscription(parsed.data.endpoint);
    return success({ unsubscribed: true });
  } catch (error) { return failure(error); }
}
