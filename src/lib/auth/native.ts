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
}

function users(): NativeUser[] {
  try {
    const parsed = JSON.parse(process.env.AUTH_USERS_JSON ?? "[]");
    return Array.isArray(parsed) ? parsed as NativeUser[] : [];
  } catch {
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

export async function setNativeSession(userId: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, encode({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }), {
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
  // Chi ha reimpostato la password vive nella tabella e non nella variabile:
  // la sessione va ricostruita da lì, altrimenti verrebbe buttato fuori.
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
