import type { Metadata } from "next";
import Link from "next/link";
import { DoorClosed, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { isNativeAuthConfigured } from "@/lib/auth/native";

export const metadata: Metadata = { title: "Accesso riservato", robots: { index: false, follow: false } };

/**
 * Non è più una pagina di accesso.
 *
 * Non esiste un profilo che sta sopra i due ristoranti, quindi non esiste un
 * ingresso comune: ogni locale entra dal proprio indirizzo riservato. Qui ci
 * si finisce solo per un link vecchio o per una sessione scaduta, e l'unica
 * cosa utile da dire è dove andare.
 */
export default function LoginPage() {
  const demoMode = !isNativeAuthConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return <main className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#111] px-5 py-16">
    <div aria-hidden className="ambient-drift absolute -top-40 right-[-20%] size-[38rem] rounded-full bg-[radial-gradient(circle,rgba(228,98,77,.14),transparent_66%)]" />
    <div className="relative w-full max-w-md text-center">
      <div className="flex justify-center text-white"><BrandLogo priority /></div>
      <span className="mt-10 inline-flex size-14 items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70"><DoorClosed className="size-6" /></span>
      <h1 className="mt-6 font-heading text-3xl tracking-tight text-white sm:text-4xl">Ogni ristorante ha il suo ingresso</h1>
      <p className="mt-4 text-sm leading-6 text-white/55">Non c’è un accesso comune ai due locali. Usa l’indirizzo riservato che ti è stato consegnato per la tua sede: è quello che ti porta al pannello giusto.</p>
      <p className="mt-8 flex items-center justify-center gap-2 text-xs text-white/40"><ShieldCheck className="size-3.5" />Se non ce l’hai più, chiedilo al titolare.</p>
      {demoMode && <Button asChild variant="outline" size="lg" className="mt-8 w-full"><Link href="/admin">Entra nella demo locale</Link></Button>}
    </div>
  </main>;
}
