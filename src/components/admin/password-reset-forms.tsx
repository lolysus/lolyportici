"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, MailCheck, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Restaurant = { slug: string; shortName: string };

/**
 * Le richieste passano dalle API, non da un'azione server: le pagine girano
 * dove il database non c'è, le `/api/*` dove c'è.
 */
async function callResetApi(method: "POST" | "PUT", body: unknown) {
  const response = await fetch("/api/auth/password-reset", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json() as { data?: Record<string, unknown>; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "Operazione non riuscita.");
  return payload.data ?? {};
}

/**
 * "Ho dimenticato la password" per una sede.
 *
 * La conferma è identica sia che l'indirizzo esista sia che non esista: dire
 * "questa email non è registrata" darebbe a chiunque l'elenco di chi lavora
 * qui, un tentativo alla volta.
 */
export function PasswordResetRequestForm({ restaurant, backHref, accessKey }: { restaurant: Restaurant; backHref: string; accessKey: string }) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      // La porta da cui arriva la richiesta: il link nell'email deve tornare qui.
      await callResetApi("POST", { email: email.trim(), scope: restaurant.slug, accessKey });
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setPending(false); }
  }

  if (done) {
    return <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-6 text-center">
      <MailCheck className="mx-auto size-8 text-emerald-300" />
      <p className="mt-4 font-heading text-2xl">Controlla la posta</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
        Se <span className="font-medium text-foreground">{email}</span> corrisponde a un account di {restaurant.shortName}, fra pochi istanti arriva il link per scegliere una nuova password. Vale un’ora e si usa una volta sola.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">Non lo trovi? Controlla lo spam prima di richiederlo.</p>
      <Button asChild variant="outline" className="mt-6 min-h-11"><Link href={backHref}><ArrowLeft />Torna all’accesso</Link></Button>
    </div>;
  }

  return <form onSubmit={submit} className="space-y-5">
    <div>
      <Label htmlFor="reset-email">Email di lavoro</Label>
      <Input id="reset-email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 bg-background" placeholder="nome@ristorante.it" />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Lo stesso indirizzo con cui entri nel pannello di {restaurant.shortName}.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending || email.trim().length === 0}>
      {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound className="size-4" />}
      {pending ? "Invio in corso…" : "Inviami il link"}
    </Button>
    <Button asChild variant="ghost" className="min-h-11 w-full"><Link href={backHref}><ArrowLeft />Torna all’accesso</Link></Button>
  </form>;
}

const reasons: Record<string, string> = {
  token_unusable: "Questo link non è più valido: è scaduto oppure è già stato usato.",
  account_missing: "Questo account non esiste più. Contatta il titolare.",
  invalid_scope: "Questo accesso non è più valido.",
};

export function PasswordResetForm({ restaurant, token, entranceHref }: { restaurant: Restaurant; token: string; entranceHref: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `checking` finché non sappiamo se il link vale: mostrare il modulo e poi
  // toglierlo sotto le dita è peggio che aspettare un istante.
  const [tokenState, setTokenState] = useState<"checking" | "usable" | "spent">(token ? "checking" : "spent");

  useEffect(() => {
    if (!token) return;
    let annullato = false;
    fetch(`/api/auth/password-reset?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data?: { usable?: boolean } }>)
      .then((payload) => { if (!annullato) setTokenState(payload.data?.usable ? "usable" : "spent"); })
      // Se il controllo non arriva non blocchiamo la persona: il modulo si
      // apre, e la verifica vera avviene comunque al salvataggio.
      .catch(() => { if (!annullato) setTokenState("usable"); });
    return () => { annullato = true; };
  }, [token]);

  const tooShort = password.length > 0 && password.length < 10;
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const data = await callResetApi("PUT", { token, scope: restaurant.slug, password }) as { applied?: boolean; reason?: string };
      if (data.applied) {
        router.push(`${entranceHref}?reimpostata=1`);
        return;
      }
      if (data.reason === "token_unusable") setTokenState("spent");
      setError(reasons[data.reason ?? ""] ?? "Non è stato possibile salvare la password.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operazione non riuscita.");
    } finally { setPending(false); }
  }

  if (tokenState === "checking") {
    return <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Controllo il link…</p>;
  }

  if (tokenState === "spent") {
    return <div className="text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300"><TimerOff className="size-5" /></div>
      <p className="mt-5 font-heading text-2xl">Link scaduto o già usato</p>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">I link durano un’ora e valgono una volta sola. È voluto: un link che resta valido per sempre, dentro una casella di posta, è una chiave lasciata nella toppa.</p>
      <Button asChild size="lg" className="mt-7 min-h-12 w-full"><Link href={`${entranceHref}/recupera`}>Richiedi un nuovo link</Link></Button>
      <Button asChild variant="ghost" className="mt-2 min-h-11 w-full"><Link href={entranceHref}>Torna all’accesso</Link></Button>
    </div>;
  }

  return <form onSubmit={submit} className="space-y-5">
    <div>
      <Label htmlFor="new-password">Nuova password</Label>
      <div className="relative mt-2">
        <Input id="new-password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={10} required value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 bg-background pr-12" aria-describedby="password-hint" />
        <button type="button" onClick={() => setVisible((value) => !value)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={visible ? "Nascondi password" : "Mostra password"}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
      </div>
      <p id="password-hint" className={tooShort ? "mt-2 text-xs text-amber-300" : "mt-2 text-xs text-muted-foreground"}>
        {tooShort ? `Ancora ${10 - password.length} caratteri.` : "Almeno 10 caratteri. Una frase che ricordi è più sicura di una parola con i simboli."}
      </p>
    </div>
    <div>
      <Label htmlFor="confirm-password">Ripeti la password</Label>
      <Input id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 h-12 bg-background" aria-invalid={mismatch} />
      {mismatch && <p className="mt-2 text-xs text-amber-300">Le due password non coincidono.</p>}
      {!mismatch && confirm.length > 0 && <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" />Coincidono.</p>}
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pending || tooShort || mismatch || password.length === 0}>
      {pending ? <LoaderCircle className="animate-spin" /> : null}
      {pending ? "Salvataggio…" : "Salva ed entra"}<ArrowRight />
    </Button>
  </form>;
}
