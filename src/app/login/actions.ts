"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { authenticateNativeUser, clearNativeSession, isNativeAuthConfigured, setNativeSession } from "@/lib/auth/native";
import { getRestaurantLocationById } from "@/config/brand";

export interface LoginState { error?: string }

const loginSchema = z.object({ email: z.email(), password: z.string().min(8) });

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Inserisci credenziali valide." };
  if (isNativeAuthConfigured()) {
    const session = await authenticateNativeUser(parsed.data.email, parsed.data.password);
    if (!session) return { error: "Email o password non corretti." };
    await setNativeSession(session.id);
    if (session.centralAccess) redirect("/admin/ceo");
    const location = getRestaurantLocationById(session.locationId);
    redirect(location ? `/admin/${location.slug}/dashboard` : "/admin/dashboard");
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Il servizio di autenticazione non è configurato." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o password non corretti." };
  redirect("/admin/dashboard");
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

