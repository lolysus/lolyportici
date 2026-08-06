import { DomainError } from "@/domains/bookings/errors";

interface Bucket { count: number; resetAt: number }
const globalBuckets = globalThis as typeof globalThis & { __rateLimitBuckets?: Map<string, Bucket> };
const buckets = globalBuckets.__rateLimitBuckets ??= new Map<string, Bucket>();

/**
 * Oltre questo numero di chiavi distinte facciamo pulizia. Serve perché la
 * chiave viene da un'intestazione che il client controlla: chi la cambiava a
 * ogni richiesta creava un secchiello nuovo ogni volta, e la mappa cresceva
 * finché il processo non finiva la memoria.
 */
const PRUNE_THRESHOLD = 5_000;

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function exceeds(key: string, limit: number, windowMs: number, now: number) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

/**
 * Freno sulle rotte pubbliche.
 *
 * `x-forwarded-for` arriva dal client e si può scrivere a mano: da sola, la
 * chiave per indirizzo non ferma nessuno, basta cambiare l'intestazione a ogni
 * richiesta per avere un secchiello nuovo. Per questo il limite per indirizzo
 * convive con un tetto complessivo per rotta: chi falsifica l'indirizzo aggira
 * il primo ma non il secondo.
 *
 * Il tetto complessivo è largo di proposito — una sera piena di prenotazioni
 * vere non deve sbatterci contro — ma taglia il traffico automatico che oggi
 * passerebbe indisturbato.
 */
export function enforceRateLimit(request: Request, scope: string, limit = 60, windowMs = 60_000, burstLimit = limit * 20) {
  const now = Date.now();
  if (buckets.size > PRUNE_THRESHOLD) prune(now);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  // Entrambi vanno contati, non in cortocircuito: se il primo bastasse a
  // uscire, il tetto complessivo non vedrebbe mai le richieste bloccate.
  const overClientLimit = exceeds(`${scope}:${forwarded ?? "local"}`, limit, windowMs, now);
  const overScopeLimit = exceeds(`${scope}:@tutti`, burstLimit, windowMs, now);

  if (overClientLimit || overScopeLimit) throw new DomainError("RATE_LIMITED", "Troppe richieste. Attendi un momento e riprova.", 429);
}

/** Azzera i contatori fra un test e l'altro. */
export function resetRateLimitForTests() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Rate limit reset is available only while running tests.");
  }
  buckets.clear();
}
