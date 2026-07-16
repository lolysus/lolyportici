"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type SessionState = "checking" | "ready" | "invalid";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const prepareSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          if (active) setSessionState("invalid");
          return;
        }

        const query = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const code = query.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const linkError = hash.get("error_description") ?? query.get("error_description");

        if (linkError) {
          if (active) {
            setError(decodeURIComponent(linkError.replace(/\+/g, " ")));
            setSessionState("invalid");
          }
          return;
        }

        if (code) await supabase.auth.exchangeCodeForSession(code);
        if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

        const { data } = await supabase.auth.getSession();
        window.history.replaceState({}, "", window.location.pathname);
        if (active) setSessionState(data.session ? "ready" : "invalid");
      } catch {
        if (active) {
          setError("Non è stato possibile verificare il link. Richiedi un nuovo invito.");
          setSessionState("invalid");
        }
      }
    };

    void prepareSession();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError("Usa almeno 10 caratteri con maiuscola, minuscola e numero.");
      return;
    }
    if (password !== confirmation) {
      setError("Le due password non coincidono.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Servizio di autenticazione non disponibile.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Non è stato possibile salvare la password. Richiedi un nuovo invito.");
      setPending(false);
      return;
    }
    const activation = await fetch("/api/auth/activate-invitation", { method: "POST" });
    if (!activation.ok) {
      setError("Password salvata, ma non è stato possibile attivare l’accesso. Contatta un amministratore.");
      setPending(false);
      return;
    }
    router.replace("/admin/dashboard");
    router.refresh();
  }

  if (sessionState === "checking") return <div className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Verifica dell’invito in corso…</div>;
  if (sessionState === "invalid") return <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">{error || "Il link non è valido o è scaduto. Richiedi un nuovo invito amministratore."}</div>;

  return <form onSubmit={handleSubmit} className="space-y-5">
    <div><Label htmlFor="password">Nuova password</Label><Input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="mt-2 h-12" /></div>
    <div><Label htmlFor="confirmation">Conferma password</Label><Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={10} required className="mt-2 h-12" /></div>
    <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />Almeno 10 caratteri, una maiuscola, una minuscola e un numero.</p>
    {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}Imposta password</Button>
  </form>;
}
