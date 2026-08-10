import "server-only";

import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { getPostgres, isPostgresConfigured } from "@/lib/postgres";
import type { Role } from "@/config/permissions";

/**
 * Gli account dello staff, con la password che si può davvero cambiare.
 *
 * Finché le credenziali stavano solo in `AUTH_USERS_JSON` non esisteva un
 * posto dove scrivere una password nuova, quindi il recupero non poteva
 * esistere. Ora la fonte è la tabella `staff_accounts`; la variabile
 * d'ambiente resta come rete di sicurezza per chi non è ancora stato
 * trasferito, e il trasferimento avviene da solo al primo cambio password.
 *
 * Perciò l'ordine è: prima il database, poi la variabile. Mai il contrario —
 * altrimenti una password vecchia rimasta nella variabile continuerebbe a
 * funzionare dopo che l'utente l'ha cambiata, che è esattamente il problema
 * che il recupero password dovrebbe risolvere.
 */

export interface StaffAccount {
  id: string;
  email: string;
  name: string;
  role: Role;
  locationId: string;
  passwordSalt: string;
  passwordHash: string;
  /**
   * Dove spedire il link del recupero, se diverso dal nome utente.
   *
   * Serve perché le due cose hanno vincoli opposti: il nome utente deve essere
   * distinto per account, il recapito può essere condiviso. Con la gestione
   * interna una sola casella raccoglie i link di tutte le sedi, e senza questa
   * separazione l'unico modo sarebbe stato dare lo stesso nome utente a due
   * account — rompere il login per far funzionare il recupero.
   */
  recoveryEmail?: string;
}

const RESET_TOKEN_MINUTES = 60;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { passwordSalt: salt, passwordHash: scryptSync(password, salt, 64).toString("hex") };
}

export function passwordMatches(password: string, account: Pick<StaffAccount, "passwordSalt" | "passwordHash">) {
  const actual = scryptSync(password, account.passwordSalt, 64);
  const expected = Buffer.from(account.passwordHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Del token si conserva solo l'impronta. Chi legge il database non deve poter
 * ricostruire un link valido, e il pepe fa sì che nemmeno una tabella
 * arcobaleno aiuti.
 */
export function hashResetToken(token: string) {
  const pepper = process.env.MANAGEMENT_TOKEN_PEPPER ?? "";
  if (!pepper && process.env.NODE_ENV === "production") throw new Error("MANAGEMENT_TOKEN_PEPPER is required in production");
  return createHash("sha256").update(`${token}:${pepper}`).digest("hex");
}

export function accountsTableAvailable() {
  return isPostgresConfigured();
}

export async function findAccountById(id: string): Promise<StaffAccount | null> {
  if (!isPostgresConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sql = getPostgres();
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, email, name, role, location_id, password_salt, password_hash, recovery_email
    from public.staff_accounts
    where id = ${id}::uuid and status = 'active'
    limit 1`;
  return rows[0] ? toAccount(rows[0]) : null;
}

export async function findAccountByEmail(email: string): Promise<StaffAccount | null> {
  if (!isPostgresConfigured()) return null;
  const sql = getPostgres();
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, email, name, role, location_id, password_salt, password_hash, recovery_email
    from public.staff_accounts
    where lower(email) = ${normalizeEmail(email)} and status = 'active'
    limit 1`;
  return rows[0] ? toAccount(rows[0]) : null;
}

function toAccount(row: Record<string, unknown>): StaffAccount {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    locationId: String(row.location_id),
    passwordSalt: String(row.password_salt),
    passwordHash: String(row.password_hash),
    recoveryEmail: typeof row.recovery_email === "string" && row.recovery_email.trim() ? row.recovery_email : undefined,
  };
}

/**
 * Scrive la password nuova, creando l'account se ancora non c'era.
 *
 * Il primo recupero di un utente che vive solo nella variabile d'ambiente lo
 * porta dentro la tabella: da quel momento la variabile per lui non conta più.
 */
export async function upsertAccountPassword(input: { email: string; name: string; role: Role; locationId: string; password: string; recoveryEmail?: string }) {
  const sql = getPostgres();
  const { passwordSalt, passwordHash } = hashPassword(input.password);
  await sql`
    insert into public.staff_accounts (id, location_id, email, name, role, password_salt, password_hash, recovery_email)
    values (${randomUUID()}, ${input.locationId}, ${normalizeEmail(input.email)}, ${input.name}, ${input.role}, ${passwordSalt}, ${passwordHash}, ${input.recoveryEmail ?? null})
    on conflict (lower(email)) do update set
      password_salt = excluded.password_salt,
      password_hash = excluded.password_hash,
      name = excluded.name,
      role = excluded.role,
      location_id = excluded.location_id,
      -- Il recapito del recupero sopravvive al cambio password: chi reimposta
      -- non deve perdere il modo di reimpostare la volta dopo.
      recovery_email = coalesce(public.staff_accounts.recovery_email, excluded.recovery_email),
      updated_at = now()`;
}

export async function createPasswordReset(email: string) {
  const sql = getPostgres();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000);
  // Le richieste precedenti ancora aperte vengono chiuse: se qualcuno chiede
  // il link tre volte, deve funzionare l'ultimo, non tre link insieme.
  await sql`
    update public.staff_password_resets
    set used_at = now()
    where lower(email) = ${normalizeEmail(email)} and used_at is null`;
  await sql`
    insert into public.staff_password_resets (email, token_hash, expires_at)
    values (${normalizeEmail(email)}, ${hashResetToken(token)}, ${expiresAt.toISOString()})`;
  return { token, expiresAt };
}

/** L'email associata a un token ancora valido, oppure `null`. */
export async function consumeResetToken(token: string) {
  if (!isPostgresConfigured()) return null;
  const sql = getPostgres();
  // Segna e restituisce in un colpo solo: due richieste contemporanee con lo
  // stesso link non possono passare entrambe.
  const rows = await sql<Array<Record<string, unknown>>>`
    update public.staff_password_resets
    set used_at = now()
    where token_hash = ${hashResetToken(token)} and used_at is null and expires_at > now()
    returning email`;
  return rows[0] ? String(rows[0].email) : null;
}

/** Controlla il token senza consumarlo, per decidere cosa mostrare nella pagina. */
export async function resetTokenIsUsable(token: string) {
  if (!isPostgresConfigured()) return false;
  const sql = getPostgres();
  const rows = await sql<Array<{ ok: boolean }>>`
    select true as ok from public.staff_password_resets
    where token_hash = ${hashResetToken(token)} and used_at is null and expires_at > now()
    limit 1`;
  return Boolean(rows[0]);
}

/**
 * Gli account di una sede, per la pagina che li mostra.
 *
 * Esiste perché quella pagina interrogava Supabase, che in produzione non è
 * configurato: `getSupabaseAdmin()` solleva un errore e la pagina Personale
 * finiva nella schermata di errore. Il ripiego previsto — due account inventati
 * chiamati "Manager Demo" e "Reception Demo" con indirizzi `@example.test` —
 * scattava solo in modalità demo, quindi in produzione non arrivava nemmeno a
 * consolare: peggio ancora se l'avesse fatto, perché due persone finte nella
 * pagina che governa gli accessi sono un invito a sbagliare.
 *
 * La fonte vera degli accessi è questa tabella: è quella che il login consulta.
 */
export async function listAccountsForLocation(locationId: string): Promise<StaffAccount[]> {
  if (!isPostgresConfigured()) return [];
  const sql = getPostgres();
  const rows = await sql<Array<Record<string, unknown>>>`
    select id, email, name, role, location_id, password_salt, password_hash, recovery_email
    from public.staff_accounts
    where location_id = ${locationId}::uuid and status = 'active'
    order by email`;
  return rows.map(toAccount);
}
