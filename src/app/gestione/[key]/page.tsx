import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Armchair, CalendarCheck2, ShieldCheck, UtensilsCrossed } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { LoginForm } from "@/components/admin/login-form";
import { restaurantForAccessKey } from "@/config/admin-access";
import { restaurantForHost } from "@/config/domains";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { getCurrentStaffSession } from "@/lib/auth/dal";
import { isNativeAuthConfigured } from "@/lib/auth/native";

/**
 * L'ingresso riservato di una sede. Non è linkato da nessuna pagina pubblica:
 * ci si arriva solo con l'indirizzo in mano.
 */

// Un indirizzo che non deve finire su Google, né essere ricostruibile da un
// crawler che segue i link.
export const metadata: Metadata = { title: "Accesso riservato", robots: { index: false, follow: false } };

export default async function RestaurantStaffEntrance({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const restaurant = restaurantForAccessKey(key);
  if (!restaurant) notFound();

  // Su un dominio dedicato esiste una sede sola: la porta dell'altra qui non
  // esiste, esattamente come non esistono le sue pagine pubbliche.
  const domainRestaurant = restaurantForHost((await headers()).get("host"));
  if (domainRestaurant && domainRestaurant.slug !== restaurant.slug) notFound();

  // Chi è già dentro non deve reinserire le credenziali per farsi rimandare
  // dove stava andando.
  const session = await getCurrentStaffSession();
  if (session?.accessibleLocationIds.includes(restaurant.id)) redirect(`/admin/${restaurant.slug}`);

  const demoMode = !isNativeAuthConfigured() && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const signals = [
    { icon: CalendarCheck2, label: "Prenotazioni", value: restaurant.shortName },
    { icon: Armchair, label: "Sala", value: `${restaurant.capacity} coperti` },
    { icon: UtensilsCrossed, label: "Sede", value: restaurant.city },
  ];

  return <main style={restaurantThemeStyle(restaurant)} className="dark grid min-h-screen bg-[#111] lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,.85fr)]">
    <div className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="ambient-drift absolute -right-40 -top-48 size-[40rem] rounded-full" style={{ background: `radial-gradient(circle, ${restaurant.theme.glow}, transparent 66%)` }} />
      <div className="relative flex items-start justify-between">
        <div className="text-white"><BrandLogo priority restaurant={restaurant} subtitle="Accesso staff" /></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/70"><span className="signal-pulse size-1.5 rounded-full bg-primary" />Ingresso riservato</span>
      </div>
      <div className="relative max-w-2xl">
        <p className="text-balance font-heading text-6xl leading-[1.03] text-white">Il pannello di {restaurant.shortName}, e nient’altro.</p>
        <p className="mt-6 max-w-lg text-base leading-7 text-white/55">Sala, prenotazioni e ospiti di {restaurant.city}. Gli altri locali del gruppo non sono raggiungibili da qui.</p>
        <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
          {signals.map((signal) => <div key={signal.label} className="bg-[#181917] p-4"><signal.icon className="size-4 text-primary" /><p className="mt-4 text-xs text-white/42">{signal.label}</p><p className="mt-1 truncate text-xs font-semibold text-white/85">{signal.value}</p></div>)}
        </div>
      </div>
      <p className="relative flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-white/35"><ShieldCheck className="size-3.5" />Indirizzo riservato · non condividere</p>
    </div>
    <div className="relative flex items-center overflow-hidden bg-background px-5 py-12 sm:px-12">
      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-10 lg:hidden"><BrandLogo priority restaurant={restaurant} subtitle="Accesso staff" /></div>
        <LoginForm demoMode={demoMode} restaurant={{ slug: restaurant.slug, shortName: restaurant.shortName, city: restaurant.city }} />
      </div>
    </div>
  </main>;
}
