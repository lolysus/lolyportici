"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { loginAction, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

/**
 * `restaurant` arriva solo dalla porta di servizio di una sede: in quel caso
 * il form dice a quale ristorante si sta entrando e il server rifiuta chi non
 * ci lavora.
 */
export function LoginForm({ demoMode, restaurant, recoveryHref }: { demoMode: boolean; restaurant?: { slug: string; shortName: string; city: string }; recoveryHref?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return <div className="surface-3d rounded-3xl border bg-card/72 p-6 backdrop-blur sm:p-8">
    <div className="mb-7 flex items-center justify-between"><div className="flex size-11 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary"><LockKeyhole className="size-5" /></div><span className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Area riservata</span></div>
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{restaurant ? `${restaurant.shortName} · ${restaurant.city}` : "Regia operativa"}</p>
    <h1 className="mt-3 font-heading text-4xl tracking-tight">Bentornato in sala.</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{restaurant ? `Ingresso riservato allo staff di ${restaurant.shortName}. Gli account delle altre sedi non passano da qui.` : "Accedi con l’account del personale. Ruolo e sede vengono verificati in modo sicuro."}</p>
    <form action={action} className="mt-8 space-y-5">
      {restaurant && <input type="hidden" name="scope" value={restaurant.slug} />}
      <div><Label htmlFor="email">Email di lavoro</Label><Input id="email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-2 h-12 bg-background" placeholder="nome@ristorante.it" /></div>
      {/* Il link sta accanto all'etichetta, non in fondo alla pagina: chi non
          ricorda la password lo cerca proprio mentre guarda quel campo. */}
      <div><div className="flex items-baseline justify-between gap-3"><Label htmlFor="password">Password</Label>{recoveryHref && <Link href={recoveryHref} className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline">Non la ricordo</Link>}</div><div className="relative mt-2"><Input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 bg-background pr-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>
      {state.error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" className="surface-3d w-full" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : null}{pending ? "Verifica in corso…" : "Accedi alla regia"}<ArrowRight /></Button>
    </form>
    {demoMode ? <>
      <div className="my-7 flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">oppure</span><span className="h-px flex-1 bg-border" /></div>
      <Button asChild variant="outline" size="lg" className="w-full"><Link href="/admin">Entra nella demo locale</Link></Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">Ambiente dimostrativo: i dati possono essere ripristinati.</p>
    </> : <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-5 text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Accesso protetto e autorizzazioni verificate sul server.</p>}
  </div>;
}
