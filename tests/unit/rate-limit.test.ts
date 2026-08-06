import { beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit, resetRateLimitForTests } from "@/lib/api/rate-limit";
import { DomainError } from "@/domains/bookings/errors";

function request(ip: string) {
  return new Request("http://localhost/api/public/v1/availability", { headers: { "x-forwarded-for": ip } });
}

function attempt(ip: string, scope: string, limit: number, burstLimit: number) {
  try {
    enforceRateLimit(request(ip), scope, limit, 60_000, burstLimit);
    return "passata";
  } catch (error) {
    return error instanceof DomainError && error.code === "RATE_LIMITED" ? "bloccata" : "altro errore";
  }
}

describe("freno sulle rotte pubbliche", () => {
  beforeEach(() => resetRateLimitForTests());

  it("ferma chi insiste dallo stesso indirizzo", () => {
    for (let i = 0; i < 3; i += 1) expect(attempt("1.1.1.1", "test-uno", 3, 1000)).toBe("passata");
    expect(attempt("1.1.1.1", "test-uno", 3, 1000)).toBe("bloccata");
  });

  it("lascia passare gli altri indirizzi", () => {
    for (let i = 0; i < 4; i += 1) attempt("1.1.1.1", "test-due", 3, 1000);
    expect(attempt("2.2.2.2", "test-due", 3, 1000)).toBe("passata");
  });

  it("non si aggira cambiando indirizzo a ogni richiesta", () => {
    // Il caso che prima passava indisturbato: l'intestazione la scrive il
    // client, quindi un indirizzo diverso ogni volta dava sempre un secchiello
    // nuovo e il limite non scattava mai.
    const esiti = Array.from({ length: 40 }, (_, index) => attempt(`10.0.0.${index}`, "test-tre", 5, 12));
    expect(esiti.filter((esito) => esito === "bloccata").length).toBeGreaterThan(0);
    // Il tetto complessivo scatta dopo 12 richieste, non prima: le prime
    // devono passare, altrimenti avremmo chiuso la porta ai clienti veri.
    expect(esiti.slice(0, 12).every((esito) => esito === "passata")).toBe(true);
  });

  it("tiene i conti separati fra rotte diverse", () => {
    for (let i = 0; i < 5; i += 1) attempt("3.3.3.3", "test-quattro", 2, 4);
    expect(attempt("3.3.3.3", "test-cinque", 2, 4)).toBe("passata");
  });
});
