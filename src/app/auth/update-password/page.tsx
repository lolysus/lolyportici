import type { Metadata } from "next";
import { BrandLogo } from "@/components/brand/brand-logo";
import { UpdatePasswordForm } from "@/components/admin/update-password-form";

export const metadata: Metadata = { title: "Imposta password" };

export default function UpdatePasswordPage() {
  return <main className="grid min-h-screen bg-[#111] lg:grid-cols-[minmax(0,1.2fr)_minmax(420px,.8fr)]">
    <div className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="w-44"><BrandLogo priority /></div>
      <div><p className="max-w-xl text-balance font-heading text-6xl leading-[1.03] text-white">La regia comincia da un accesso sicuro.</p><p className="mt-6 max-w-lg text-base leading-7 text-white/55">Imposta la password personale per gestire prenotazioni, sala e relazione con gli ospiti.</p></div>
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-white/35">Regia Ristoranti · due attività</p>
      <div aria-hidden className="absolute -bottom-36 -right-24 size-96 rounded-full border border-white/10" />
    </div>
    <div className="flex items-center bg-background px-5 py-12 sm:px-12"><div className="mx-auto w-full max-w-md">
      <div className="mb-10 w-40 lg:hidden"><BrandLogo priority /></div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Primo accesso</p>
      <h1 className="mt-3 font-heading text-4xl tracking-tight">Proteggi il tuo account.</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-muted-foreground">Il link è personale e può essere usato una sola volta.</p>
      <UpdatePasswordForm />
    </div></div>
  </main>;
}
