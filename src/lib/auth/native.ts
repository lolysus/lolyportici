import "server-only";

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { rolePermissions, type Role } from "@/config/permissions";
import { restaurantConfig } from "@/config/brand";
import { findAccountByEmail, findAccountById, passwordMatches } from "@/lib/auth/staff-accounts";
import type { StaffSession } from "@/types/domain";

const COOKIE_NAME = "loly_staff_session";
const SESSION_SECONDS = 8 * 60 * 60;

interface NativeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  locationId: string;
  accessibleLocationIds: string[];
  passwordSalt: string;
  passwordHash: string;
}

interface SessionPayload {
  sub: string;
  exp: number;
  /**
   * L'identità dell'utente, portata dentro il cookie firmato.
   *
   * Serve perché le pagine girano su **Vercel, che non ha `DATABASE_URL`**: da
   * lì `findAccountById` non può funzionare, e senza questi campi la sessione di
   * un account che vive solo in `staff_accounts` — cioè chiunque abbia
   * reimpostato la password — risulterebbe inesistente a ogni caricamento.
   *
   * Non è un rischio: il cookie è firmato in HMAC-SHA256 con
   * `AUTH_SESSION_SECRET`, quindi il contenuto non è falsificabile. Il prezzo è
   * che un cambio di ruolo o di permessi entra in vigore al prossimo accesso e
   * non entro le otto ore di sessione in corso — un compromesso normale, e molto
   * meno grave di un pannello che non riconosce chi ha appena cambiato password.
   */
  ident?: {
    email: string;
    name: string;
    role: Role;
    organizationId: string;
    locationId: string;
    accessibleLocationIds: string[];
  };
}

/**
 * Gli account dalla variabile d'ambiente.
 *
 * Il `trim()` non è pignoleria: un valore incollato da un file salvato su
 * Windows arriva con un BOM (U+FEFF) davanti alla parentesi quadra, e
 * `JSON.parse` lo rifiuta. Senza questa riga l'elenco resta vuoto e non se ne
 * accorge nessuno — chi ha già la sessione continua a lavorare, ma nessuno
 * riesce più ad accedere e il recupero password non trova mai un account a cui
 * spedire il link. È già capitato: su Railway il valore aveva il BOM.
 *
 * Per lo stesso motivo il fallimento va nei log invece di essere ingoiato: un
 * elenco vuoto per errore di battitura è indistinguibile da un elenco vuoto
 * per scelta.
 */
function users(): NativeUser[] {
  const raw = process.env.AUTH_USERS_JSON?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NativeUser[];
    console.error("[auth] AUTH_USERS_JSON non è un elenco: nessun account disponibile");
    return [];
  } catch (error) {
    console.error("[auth] AUTH_USERS_JSON illeggibile: nessun account disponibile", error);
    return [];
  }
}

export function isNativeAuthConfigured() {
  return Boolean(process.env.AUTH_SESSION_SECRET && users().length > 0);
}

function signature(payload: string) {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET is not configured securely");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, suppliedSignature] = token.split(".");
  if (!body || !suppliedSignature) return null;
  const expected = Buffer.from(signature(body));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
  } catch {
    return null;
  }
}

function sessionFor(user: NativeUser): StaffSession {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: [...rolePermissions[user.role]],
    organizationId: user.organizationId,
    locationId: user.locationId,
    accessibleLocationIds: [...user.accessibleLocationIds],
    demo: false,
  };
}

/**
 * Il database viene prima della variabile d'ambiente.
 *
 * Chi ha cambiato password ha la sua nella tabella: se guardassimo prima la
 * variabile, la vecchia password continuerebbe a funzionare e il recupero non
 * servirebbe a niente.
 */
async function accountSession(email: string, password: string) {
  const account = await findAccountByEmail(email).catch(() => null);
  if (!account || !passwordMatches(password, account)) return null;
  return sessionFor({
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    organizationId: restaurantConfig.organizationId,
    locationId: account.locationId,
    accessibleLocationIds: [account.locationId],
    passwordSalt: account.passwordSalt,
    passwordHash: account.passwordHash,
  });
}

export async function authenticateNativeUser(email: string, password: string) {
  const fromDatabase = await accountSession(email, password);
  if (fromDatabase) return fromDatabase;

  const user = users().find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
  if (!user) return null;
  // Chi è già passato nella tabella non deve poter rientrare con la password
  // vecchia rimasta nella variabile d'ambiente.
  const migrated = await findAccountByEmail(email).catch(() => null);
  if (migrated) return null;
  const actual = scryptSync(password, user.passwordSalt, 64);
  const expected = Buffer.from(user.passwordHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  return sessionFor(user);
}

/** L'account come lo conosce la variabile d'ambiente, per chi non è ancora nella tabella. */
export function nativeUserByEmail(email: string) {
  const user = users().find((candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase());
  if (!user) return null;
  return { email: user.email, name: user.name, role: user.role, locationId: user.locationId };
}

export async function setNativeSession(session: StaffSession) {
  const store = await cookies();
  const payload: SessionPayload = {
    sub: session.id,
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    ident: {
      email: session.email,
      name: session.name,
      role: session.role,
      organizationId: session.organizationId,
      locationId: session.locationId,
      accessibleLocationIds: [...session.accessibleLocationIds],
    },
  };
  store.set(COOKIE_NAME, encode(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearNativeSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getNativeStaffSession() {
  if (!isNativeAuthConfigured()) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = token ? decode(token) : null;
  if (!payload) return null;
  const user = users().find((candidate) => candidate.id === payload.sub);
  if (user) return sessionFor(user);

  // L'identità nel cookie firmato viene prima del database: è l'unica strada
  // dove il database non c'è, cioè su Vercel, dove girano tutte le pagine.
  if (payload.ident) {
    return {
      id: payload.sub,
      name: payload.ident.name,
      email: payload.ident.email,
      role: payload.ident.role,
      permissions: [...rolePermissions[payload.ident.role]],
      organizationId: payload.ident.organizationId,
      locationId: payload.ident.locationId,
      accessibleLocationIds: [...payload.ident.accessibleLocationIds],
      demo: false,
    };
  }

  // Cookie emesso prima di questo cambiamento: si ricade sulla tabella, che
  // funziona dove il database esiste.
  const account = await findAccountById(payload.sub).catch(() => null);
  if (!account) return null;
  return sessionFor({
    id: account.id,
    email: account.email,
    name: account.name,
    role: account.role,
    organizationId: restaurantConfig.organizationId,
    locationId: account.locationId,
    accessibleLocationIds: [account.locationId],
    passwordSalt: account.passwordSalt,
    passwordHash: account.passwordHash,
  });
}
