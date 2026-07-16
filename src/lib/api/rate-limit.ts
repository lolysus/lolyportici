import { DomainError } from "@/domains/bookings/errors";

interface Bucket { count: number; resetAt: number }
const globalBuckets = globalThis as typeof globalThis & { __rateLimitBuckets?: Map<string, Bucket> };
const buckets = globalBuckets.__rateLimitBuckets ??= new Map<string, Bucket>();

export function enforceRateLimit(request: Request, scope: string, limit = 60, windowMs = 60_000) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const key = `${scope}:${forwarded ?? "local"}`;
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) throw new DomainError("RATE_LIMITED", "Troppe richieste. Attendi un momento e riprova.", 429);
}

