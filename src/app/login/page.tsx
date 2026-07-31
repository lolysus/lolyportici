import type { Metadata } from "next";
import { AudioWaveform, CalendarCheck2, DatabaseZap, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginForm } from "@/components/admin/login-form";
import { isNativeAuthConfigured } from "@/lib/auth/native";

export const metadata: Metadata = { title: "Accesso staff" };

const systemSignals = [
  { icon: CalendarCheck2, label: "Prenotazioni", value: "Sincronizzate" },
  { icon: AudioWaveform, label: "Canale voce", value: "Monitorato" },
  { icon: DatabaseZap, label: "Dati operativi", value: "Persistenti" },
];

export default function LoginPage() {
  const demoMode = !isNativeAuthConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  return <main className="grid min-h-screen bg-[#111] lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,.85fr)]">
    <div className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="ambient-drift absolute -right-40 -top-48 size-[40rem] rounded-full bg-[radial-gradient(circle,rgba(228,98,77,.18),transparent_66%)]" />
      <div aria-hidden className="absolute -bottom-56 -left-40 size-[34rem] rounded-full border border-white/[0.055]" />
      <div className="relative flex items-start justify-between"><div className="text-white"><BrandLogo priority /></div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-3 py-1.5 text-[10px] font-medium text-emerald-200"><span className="signal-pulse size-1.5 rounded-full bg-emerald-400" />Sistema operativo</span></div>
      <div className="relative max-w-2xl"><p className="text-balance font-heading text-6xl leading-[1.03] text-white">Ogni servizio, sotto controllo. Ogni ospite, riconosciuto.</p><p className="mt-6 max-w-lg text-base leading-7 text-white/55">Prenotazioni, sala e canali di contatto in un’unica regia discreta.</p>
        <div className="perspective-stage mt-10"><div className="depth-card surface-3d-dark grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">{systemSignals.map((signal) => <div key={signal.label} className="bg-[#181917] p-4"><signal.icon className="size-4 text-[#e97866]" /><p className="mt-4 text-xs text-white/42">{signal.label}</p><p className="mt-1 text-xs font-semibold text-white/85">{signal.value}</p></div>)}</div></div>
      </div>
      <div className="relative flex items-center justify-between"><p className="font-mono text-xs uppercase tracking-[0.22em] text-white/35">Regia Ristoranti · due attività</p><span className="flex items-center gap-2 text-[10px] text-white/35"><ShieldCheck className="size-3.5" />Accesso cifrato</span></div>
    </div>
    <div className="relative flex items-center overflow-hidden bg-background px-5 py-12 sm:px-12"><div aria-hidden className="absolute -right-28 top-16 size-72 rounded-full bg-[radial-gradient(circle,rgba(228,98,77,.12),transparent_66%)]" /><div className="relative mx-auto w-full max-w-md"><div className="mb-10 lg:hidden"><BrandLogo priority /></div><LoginForm demoMode={demoMode} /></div></div>
  </main>;
}
