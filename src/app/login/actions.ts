"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authenticateNativeUser, clearNativeSession, isNativeAuthConfigured, setNativeSession } from "@/lib/auth/native";
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
    const session = await authenticateNativeUser(parsed.data.email, parsed.data.password);
    if (!session) return { error: "Email o password non corretti." };
    if (scope && !session.accessibleLocationIds.includes(scope.id)) {
      await clearNativeSession();
      return { error: `Questo account non è abilitato a ${scope.shortName}. Usa il link della tua sede.` };
    }
    await setNativeSession(session.id);
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

