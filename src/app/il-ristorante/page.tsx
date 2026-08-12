import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accessibility, ArrowRight, Car, Leaf, Sofa, Sun, UtensilsCrossed } from "lucide-react";
import { SiteShell } from "@/components/site/site-shell";
import { PhotoPanel } from "@/components/site/photo-panel";
import { siteRestaurant } from "@/lib/site-host";
import { loadSiteData } from "@/lib/site-data";

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await siteRestaurant();
  if (!restaurant) return {};
  const city = restaurant.city.split("·")[0].trim();
  const title = `Il ristorante · ${restaurant.name}`;
  const description = `${restaurant.name}: cucina giapponese e fusion a ${city}, sala interna${restaurant.seating.outdoor > 0 ? " e spazio all’aperto" : ""} e ampio parcheggio privato.`;
  return { title, description, alternates: { canonical: "/il-ristorante" }, openGraph: { type: "website", title, description, siteName: restaurant.name } };
}

export default async function IlRistorantePage() {
  const restaurant = await siteRestaurant();
  if (!restaurant) notFound();
  const site = await loadSiteData(restaurant);
  const city = restaurant.city.split("·")[0].trim();
  const parking = site.guest.highlight.trim() || site.guest.parkingInfo.trim();

  const spaces = [
    { icon: Sofa, title: "Sala interna", value: site.seating.indoor > 0 ? `${site.seating.indoor} posti` : "Ambiente curato", note: "Accogliente a pranzo come a cena." },
    site.seating.outdoor > 0 ? { icon: Sun, title: "All’aperto", value: `${site.seating.outdoor} posti`, note: "Lo spazio esterno, quando il tempo accompagna." } : null,
    { icon: Car, title: "Parcheggio", value: "Privato", note: parking || "Posto auto per gli ospiti." },
  ].filter(Boolean) as { icon: typeof Sofa; title: string; value: string; note: string }[];

  const beforeYouCome = [
    site.guest.arrivalMessage.trim() ? { icon: UtensilsCrossed, title: "Il tuo arrivo", text: site.guest.arrivalMessage } : null,
    site.guest.dietaryNotice.trim() ? { icon: Leaf, title: "Allergie e intolleranze", text: site.guest.dietaryNotice } : null,
    site.guest.accessibilityInfo.trim() ? { icon: Accessibility, title: "Accessibilità", text: site.guest.accessibilityInfo } : null,
  ].filter(Boolean) as { icon: typeof Leaf; title: string; text: string }[];

  return <SiteShell restaurant={restaurant} site={site}>
    {/* Intro */}
    <section className="mx-auto max-w-6xl px-5 pb-4 pt-16 sm:pt-20">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">Il ristorante</p>
      <h1 className="max-w-3xl text-balance font-heading text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-6xl">Cucina giapponese e fusion, ad {city}.</h1>
      <p className="mt-6 max-w-2xl text-lg leading-7 text-white/60">
        Da {restaurant.shortName} il sushi incontra la cucina fusion in piatti preparati con cura. Un ambiente pensato per stare bene — dal pranzo veloce alla cena con calma — con ampio parcheggio privato e prenotazione online.
      </p>
    </section>

    {/* Esperienza */}
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-20">
      <PhotoPanel restaurant={restaurant} label="La sala" className="min-h-[300px] lg:min-h-[420px]" />
      <div>
        <h2 className="max-w-md text-balance font-heading text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Un rito quotidiano, fatto bene.</h2>
        <p className="mt-5 max-w-lg leading-7 text-white/60">
          Materie prime scelte, preparazioni curate e un servizio attento: {restaurant.shortName} è il posto dove concedersi il sushi senza rinunciare alla comodità di un tavolo prenotato e di un parcheggio davanti.
        </p>
        <Link href="/prenotazione" className="mt-7 inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline underline-offset-4">
          Prenota un tavolo<ArrowRight className="size-4" />
        </Link>
      </div>
    </section>

    {/* Gli spazi */}
    <section className="border-y border-white/8 bg-white/[0.015]">
      <div className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Gli spazi</h2>
        <div className="mt-9 grid gap-5 sm:grid-cols-3">
          {spaces.map((space) => <div key={space.title} className="surface-3d-dark rounded-2xl border border-white/10 bg-card p-6">
            <space.icon className="size-5 text-primary" />
            <p className="mt-4 text-sm font-medium uppercase tracking-wide text-white/45">{space.title}</p>
            <p className="mt-1 text-2xl font-semibold">{space.value}</p>
            <p className="mt-2 text-sm leading-6 text-white/55">{space.note}</p>
          </div>)}
        </div>
      </div>
    </section>

    {/* Prima di venire */}
    {beforeYouCome.length > 0 && <section className="mx-auto max-w-6xl px-5 py-16 lg:py-20">
      <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Prima di venire</h2>
      <div className="mt-9 grid gap-5 sm:grid-cols-3">
        {beforeYouCome.map((item) => <div key={item.title} className="rounded-2xl border border-white/10 bg-card/60 p-6">
          <item.icon className="size-5 text-primary" />
          <p className="mt-4 font-semibold">{item.title}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{item.text}</p>
        </div>)}
      </div>
    </section>}

    {/* CTA */}
    <section className="mx-auto max-w-6xl px-5 pb-8">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-primary/20 bg-primary/[0.06] p-8 sm:flex-row sm:items-center sm:p-10">
        <div>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Ti aspettiamo.</h2>
          <p className="mt-2 text-white/60">Prenota online: disponibilità reale e conferma immediata.</p>
        </div>
        <Link href="/prenotazione" className="inline-flex min-h-13 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Prenota un tavolo<ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  </SiteShell>;
}
