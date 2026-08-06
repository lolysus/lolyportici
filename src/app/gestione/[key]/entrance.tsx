import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { restaurantForAccessKey } from "@/config/admin-access";
import { restaurantForHost } from "@/config/domains";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import type { RestaurantLocation } from "@/config/brand";

/**
 * Le tre schermate della porta di servizio — accesso, richiesta del link,
 * nuova password — sono la stessa stanza vista in tre momenti. Condividere la
 * cornice evita che si somiglino "quasi": su una pagina che chiede una
 * password, un dettaglio fuori posto sembra un tentativo di raggiro.
 */

export async function resolveEntrance(key: string): Promise<RestaurantLocation> {
  const restaurant = restaurantForAccessKey(key);
  if (!restaurant) notFound();
  // Su un dominio dedicato esiste una sede sola: la porta dell'altra qui non
  // esiste, come non esistono le sue pagine pubbliche.
  const domainRestaurant = restaurantForHost((await headers()).get("host"));
  if (domainRestaurant && domainRestaurant.slug !== restaurant.slug) notFound();
  return restaurant;
}

export function EntranceLayout({ restaurant, headline, lead, children }: {
  restaurant: RestaurantLocation;
  headline: string;
  lead: string;
  children: React.ReactNode;
}) {
  return <main style={restaurantThemeStyle(restaurant)} className="dark grid min-h-screen bg-[#111] lg:grid-cols-[minmax(0,1.15fr)_minmax(430px,.85fr)]">
    <div className="relative hidden overflow-hidden border-r border-white/10 lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div aria-hidden className="ambient-drift absolute -right-40 -top-48 size-[40rem] rounded-full" style={{ background: `radial-gradient(circle, ${restaurant.theme.glow}, transparent 66%)` }} />
      <div className="relative flex items-start justify-between">
        <div className="text-white"><BrandLogo priority restaurant={restaurant} subtitle="Accesso staff" /></div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-medium text-white/70"><span className="signal-pulse size-1.5 rounded-full bg-primary" />Ingresso riservato</span>
      </div>
      <div className="relative max-w-2xl">
        <p className="text-balance font-heading text-6xl leading-[1.03] text-white">{headline}</p>
        <p className="mt-6 max-w-lg text-base leading-7 text-white/55">{lead}</p>
      </div>
      <p className="relative flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-white/35"><ShieldCheck className="size-3.5" />Indirizzo riservato · non condividere</p>
    </div>
    <div className="relative flex items-center overflow-hidden bg-background px-5 py-12 sm:px-12">
      <div className="relative mx-auto w-full max-w-md">
        <div className="mb-10 lg:hidden"><BrandLogo priority restaurant={restaurant} subtitle="Accesso staff" /></div>
        {children}
      </div>
    </div>
  </main>;
}
