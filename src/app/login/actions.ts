"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface LoginState { error?: string }

const loginSchema = z.object({ email: z.email(), password: z.string().min(8) });

export async function loginAction(_state: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Inserisci credenziali valide." };
  const supabase = await getSupabaseServerClient();
  if (!supabase) return { error: "Supabase Auth non è configurato. Usa il pulsante Demo." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o password non corretti." };
  redirect("/admin/dashboard");
}

export async function logoutAction() {
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/login");
}

