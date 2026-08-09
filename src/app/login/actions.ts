"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authenticateNativeUser, clearNativeSession, isNativeAuthConfigured, setNativeSession } from "@/lib/auth/native";
import { isPostgresConfigured } from "@/lib/postgres";
import type { StaffSession } from "@/types/domain";
import { getRestaurantLocationById, getRestaurantLocationBySlug } from "@/config/brand";

export interface LoginState { error?: string }

const loginSchema = z.object({ email: z.email(), password: z.string().min(8) });

/**
 * Da una porta di servizio si entra in un ristorante solo. Chi arriva dal link
 * riservato di Ardea con le credenziali di Portici non viene fatto passare e
 * non resta nemmeno autenticato: altrimenti basterebbe cambiare l'indirizzo
 * nella barra per ritrovarsi nell'altro pannello.
 */
export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Inserisci credenziali valide." };
  const scopeSlug = String(formData.get("scope") ?? "").trim();
  const scope = scopeSlug ? getRestaurantLocationBySlug(scopeSlug) : undefined;
  if (scopeSlug && !scope) return { error: "Questo accesso non è più valido." };

  if (isNativeAuthConfigured()) {
    const session = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!session) return { error: "Email o password non corretti." };
    if (scope && !session.accessibleLocationIds.includes(scope.id)) {
      await clearNativeSession();
      return { error: `Questo account non è abilitato a ${scope.shortName}. Usa il link della tua sede.` };
    }
    await setNativeSession(session);
    if (scope) redirect(`/admin/${scope.slug}`);
    const location = getRestaurantLocationById(session.locationId);
    redirect(location ? `/admin/${location.slug}/dashboard` : "/admin");
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Il servizio di autenticazione non è configurato." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o password non corretti." };
  redirect(scope ? `/admin/${scope.slug}` : "/admin");
}

export async function logoutAction() {
  if (isNativeAuthConfigured()) {
    await clearNativeSession();
    redirect("/login");
  }
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}


/**
 * Verifica le credenziali dove le credenziali si possono davvero leggere.
 *
 * Questa azione gira su Vercel, che **non ha `DATABASE_URL`**: lì
 * `authenticateNativeUser` vede solo `AUTH_USERS_JSON` e non la tabella
 * `staff_accounts`. Risultato, prima di questa correzione: chi reimpostava la
 * password non riusciva più a entrare, e la vecchia continuava a funzionare
 * perché anche il controllo che doveva rifiutarla interroga il database.
 *
 * Dove il database c'è — su Railway, dove la stessa azione può girare — si
 * verifica in casa e non si fa un salto di rete inutile.
 */
async function verifyCredentials(email: string, password: string): Promise<StaffSession | null> {
  if (isPostgresConfigured()) return await authenticateNativeUser(email, password);

  const backend = process.env.BACKEND_ORIGIN?.replace(/\/+$/, "");
  const secret = process.env.AUTH_SESSION_SECRET ?? "";
  if (!backend || secret.length < 32) {
    // Senza una delle due non si può verificare nulla: meglio un accesso
    // rifiutato di un accesso concesso al buio.
    console.error("[login] BACKEND_ORIGIN o AUTH_SESSION_SECRET assenti: impossibile verificare le credenziali");
    return null;
  }
  try {
    const response = await fetch(`${backend}/api/auth/verify-credentials`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-auth": secret },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[login] verifica credenziali non riuscita", response.status);
      return null;
    }
    const payload = await response.json() as { data?: { authenticated: boolean; session: StaffSession | null } };
    return payload.data?.authenticated ? payload.data.session ?? null : null;
  } catch (error) {
    console.error("[login] verifica credenziali non raggiungibile", error);
    return null;
  }
}
