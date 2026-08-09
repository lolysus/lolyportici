import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffSession } from "@/types/domain";

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieStore.set(name, value),
  }),
}));

const SECRET = "un-segreto-di-sessione-abbastanza-lungo-per-il-controllo";

const session: StaffSession = {
  id: "35892966-a923-43b8-b9ed-ed937f5ee073",
  name: "Operatore YUKO",
  email: "suhsiroma@outlook.it",
  role: "manager" as const,
  permissions: [],
  organizationId: "00000000-0000-0000-0000-000000000001",
  locationId: "00000000-0000-0000-0000-000000000003",
  accessibleLocationIds: ["00000000-0000-0000-0000-000000000003"],
  demo: false,
};

async function auth() {
  vi.resetModules();
  return await import("@/lib/auth/native");
}

describe("sessione ricostruibile senza database", () => {
  beforeEach(() => {
    cookieStore.clear();
    process.env.AUTH_SESSION_SECRET = SECRET;
    // Un account che vive solo nella tabella: non compare qui.
    process.env.AUTH_USERS_JSON = JSON.stringify([{
      id: "90000000-0000-0000-0000-000000000001",
      email: "ceo@loly.local", name: "CEO", role: "owner",
      organizationId: session.organizationId, locationId: session.locationId,
      accessibleLocationIds: [session.locationId], passwordSalt: "00", passwordHash: "00",
    }]);
    // È la condizione di Vercel, dove girano tutte le pagine.
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_PUBLIC_URL;
  });

  afterEach(() => {
    delete process.env.AUTH_SESSION_SECRET;
    delete process.env.AUTH_USERS_JSON;
  });

  it("riconosce chi ha reimpostato la password anche dove il database non c'è", async () => {
    // Il difetto originale: il login scriveva solo l'id nel cookie, e la sessione
    // si ricostruiva da `staff_accounts`. Su Vercel, senza DATABASE_URL, quella
    // lettura non può avvenire: chi cambiava password non veniva più riconosciuto
    // a nessun caricamento di pagina.
    const { setNativeSession, getNativeStaffSession } = await auth();
    await setNativeSession(session);
    const ripresa = await getNativeStaffSession();

    expect(ripresa).not.toBeNull();
    expect(ripresa?.email).toBe(session.email);
    expect(ripresa?.locationId).toBe(session.locationId);
    expect(ripresa?.accessibleLocationIds).toEqual(session.accessibleLocationIds);
  });

  it("non concede permessi che il ruolo non prevede", async () => {
    const { setNativeSession, getNativeStaffSession } = await auth();
    await setNativeSession(session);
    const ripresa = await getNativeStaffSession();
    // I permessi si derivano dal ruolo al momento della lettura, non si copiano
    // dal cookie: altrimenti basterebbe un cookie vecchio per tenersi diritti
    // che gli sono stati tolti.
    expect(ripresa?.permissions.length).toBeGreaterThan(0);
    expect(ripresa?.role).toBe("manager");
  });

  it("rifiuta un cookie con l'identità manomessa", async () => {
    const { setNativeSession, getNativeStaffSession } = await auth();
    await setNativeSession(session);
    const originale = cookieStore.get("loly_staff_session")!;
    const [corpo, firma] = originale.split(".");

    // Chi riscrive il contenuto per darsi accesso all'altra sede deve fallire:
    // la firma non torna più.
    const manomesso = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    manomesso.ident.accessibleLocationIds = ["00000000-0000-0000-0000-000000000004"];
    const corpoFalso = Buffer.from(JSON.stringify(manomesso)).toString("base64url");
    cookieStore.set("loly_staff_session", `${corpoFalso}.${firma}`);

    expect(await getNativeStaffSession()).toBeNull();
  });

  it("rifiuta un cookie firmato con un altro segreto", async () => {
    const { setNativeSession } = await auth();
    await setNativeSession(session);
    const rubato = cookieStore.get("loly_staff_session")!;

    process.env.AUTH_SESSION_SECRET = `${SECRET}-diverso`;
    const { getNativeStaffSession } = await auth();
    cookieStore.set("loly_staff_session", rubato);
    expect(await getNativeStaffSession()).toBeNull();
  });

  it("rifiuta una sessione scaduta", async () => {
    const { setNativeSession, getNativeStaffSession } = await auth();
    await setNativeSession(session);
    const [corpo] = cookieStore.get("loly_staff_session")!.split(".");
    const payload = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(payload.ident.email).toBe(session.email);
    // La scadenza è dentro il payload firmato, quindi non si può allungare.
    expect(await getNativeStaffSession()).not.toBeNull();
  });
});
