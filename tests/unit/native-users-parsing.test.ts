import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));

const original = process.env.AUTH_USERS_JSON;

const account = {
  id: "90000000-0000-0000-0000-000000000002",
  email: "suhsiroma@outlook.it",
  name: "Operatore YUKO",
  role: "manager",
  organizationId: "00000000-0000-0000-0000-000000000001",
  locationId: "00000000-0000-0000-0000-000000000003",
  accessibleLocationIds: ["00000000-0000-0000-0000-000000000003"],
  passwordSalt: "00",
  passwordHash: "00",
};

async function nativeUserByEmail(email: string) {
  // Import a freddo: `users()` legge la variabile a ogni chiamata, ma il modulo
  // va ricaricato per non portarsi dietro lo stato di un altro test.
  vi.resetModules();
  const native = await import("@/lib/auth/native");
  return native.nativeUserByEmail(email);
}

afterEach(() => {
  if (original === undefined) delete process.env.AUTH_USERS_JSON;
  else process.env.AUTH_USERS_JSON = original;
});

describe("lettura degli account dalla variabile d'ambiente", () => {
  it("trova l'account con un valore pulito", async () => {
    process.env.AUTH_USERS_JSON = JSON.stringify([account]);
    expect((await nativeUserByEmail("suhsiroma@outlook.it"))?.locationId).toBe(account.locationId);
  });

  it("sopravvive al BOM davanti al JSON", async () => {
    // Un valore incollato da un file salvato su Windows arriva così. Senza
    // tolleranza l'elenco resta vuoto: nessuno accede e il recupero password
    // non trova mai un account a cui spedire il link. È già capitato in
    // produzione, su Railway.
    process.env.AUTH_USERS_JSON = `﻿${JSON.stringify([account])}`;
    expect((await nativeUserByEmail("suhsiroma@outlook.it"))?.email).toBe("suhsiroma@outlook.it");
  });

  it("sopravvive agli spazi e alle andate a capo intorno al JSON", async () => {
    process.env.AUTH_USERS_JSON = `\n  ${JSON.stringify([account])}  \n`;
    expect(await nativeUserByEmail("suhsiroma@outlook.it")).not.toBeNull();
  });

  it("ignora le maiuscole nell'indirizzo", async () => {
    process.env.AUTH_USERS_JSON = JSON.stringify([account]);
    expect(await nativeUserByEmail(" SuhsiRoma@Outlook.IT ")).not.toBeNull();
  });

  it("non inventa account quando il valore è illeggibile", async () => {
    process.env.AUTH_USERS_JSON = "{non-json";
    expect(await nativeUserByEmail("suhsiroma@outlook.it")).toBeNull();
  });
});
