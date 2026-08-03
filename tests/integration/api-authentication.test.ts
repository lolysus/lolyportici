import { describe, expect, it } from "vitest";
import { failure } from "@/lib/api/response";
import { DomainError, PermissionDeniedError } from "@/domains/bookings/errors";

/**
 * `requirePermission` protegge pagine e API con lo stesso codice, e senza
 * sessione chiama `redirect("/login")`. Dentro un route handler quel redirect
 * arriva al catch come eccezione: se lo trattiamo come errore generico l'API
 * risponde 500, cioè "il server è rotto" al posto di "non sei autenticato".
 */
function redirectError(to = "/login") {
  const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
  error.digest = `NEXT_REDIRECT;replace;${to};307;`;
  return error;
}

describe("API error mapping", () => {
  it("answers 401 when the session is missing instead of 500", async () => {
    const response = failure(redirectError());
    expect(response.status).toBe(401);
    const body = await response.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("keeps the status carried by a domain error", async () => {
    expect(failure(new PermissionDeniedError()).status).toBe(403);
    expect(failure(new DomainError("TEAPOT", "Non posso.", 418)).status).toBe(418);
  });

  it("reports malformed JSON as a client error", () => {
    expect(failure(new SyntaxError("Unexpected token")).status).toBe(400);
  });

  it("still returns 500 for anything genuinely unexpected", () => {
    expect(failure(new Error("boom")).status).toBe(500);
  });
});
