import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { authenticateNativeUser } from "@/lib/auth/native";
import { PermissionDeniedError } from "@/domains/bookings/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { failure, success, validationFailure } from "@/lib/api/response";

/**
 * Verifica una coppia email/password dove il database esiste.
 *
 * Il login è un'azione server e gira su **Vercel**, che non ha `DATABASE_URL`:
 * lì `isPostgresConfigured()` è falso, `findAccountByEmail` restituisce `null` e
 * l'unica fonte di credenziali diventa `AUTH_USERS_JSON`. Conseguenza: una
 * password reimpostata dal recupero finiva in `staff_accounts` — su Railway, il
 * solo servizio col database — e **il login non poteva vederla**. Chi cambiava
 * password non riusciva più a entrare, mentre la vecchia continuava a funzionare
 * perché anche il controllo che doveva rifiutarla passa dal database.
 *
 * Questa rotta gira su Railway, quindi vede la tabella. È lo stesso spostamento
 * già fatto per il recupero password, per la stessa ragione.
 *
 * Non è pubblica: richiede il segreto di sessione, che entrambe le piattaforme
 * hanno per progetto e che non lascia mai il server. Senza questo vincolo
 * diventerebbe uno sportello per provare password a raffica, e il limite per
 * indirizzo IP non servirebbe a nulla — le chiamate arrivano tutte da Vercel,
 * quindi da un solo IP.
 */

const schema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

function callerIsTrusted(request: Request) {
  const secret = process.env.AUTH_SESSION_SECRET ?? "";
  const supplied = request.headers.get("x-internal-auth") ?? "";
  if (secret.length < 32 || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(secret), Buffer.from(supplied));
}

export async function POST(request: Request) {
  try {
    if (!callerIsTrusted(request)) return failure(new PermissionDeniedError());
    // Anche fra servizi: un ciclo impazzito non deve poter martellare scrypt,
    // che è volutamente costoso.
    enforceRateLimit(request, "verify-credentials", 120, 60_000, 600);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationFailure(parsed.error.flatten());

    const session = await authenticateNativeUser(parsed.data.email, parsed.data.password);
    // Risposta identica in caso di email inesistente o password sbagliata: la
    // differenza direbbe a chi prova quali indirizzi esistono.
    return success({ authenticated: Boolean(session), session: session ?? null });
  } catch (error) { return failure(error); }
}
