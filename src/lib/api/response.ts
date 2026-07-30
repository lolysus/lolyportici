import { DomainError } from "@/domains/bookings/errors";

export function success<T>(data: T, init?: ResponseInit) {
  return Response.json({ success: true, data }, init);
}

export function failure(error: unknown) {
  if (error instanceof DomainError) {
    return Response.json({ success: false, error: { code: error.code, message: error.message, details: error.details } }, { status: error.status });
  }
  if (error instanceof SyntaxError) {
    return Response.json({ success: false, error: { code: "INVALID_JSON", message: "Il corpo della richiesta non è valido.", details: {} } }, { status: 400 });
  }
  console.error("Unhandled API error", error);
  return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Si è verificato un errore. Riprova.", details: {} } }, { status: 500 });
}

export function validationFailure(details: unknown) {
  return Response.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Controlla i dati inseriti.", details } }, { status: 422 });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const requestOrigin = new URL(request.url).origin;
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  const allowedOrigins = new Set([
    requestOrigin,
    ...(forwardedHost ? [`${forwardedProtocol}://${forwardedHost}`] : []),
    ...trustedOrigins,
  ]);
  if (!allowedOrigins.has(origin.replace(/\/+$/, ""))) {
    throw new DomainError("CSRF_CHECK_FAILED", "Origine della richiesta non valida.", 403);
  }
}

