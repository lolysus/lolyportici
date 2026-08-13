import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accessibility, ArrowRight, Car, Clock3, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { SiteShell } from "@/components/site/site-shell";
import { siteRestaurant } from "@/lib/site-host";
import { loadSiteData, weeklyOpening } from "@/lib/site-data";
import { restaurantOgImage } from "@/lib/og-image";

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await siteRestaurant();
  if (!restaurant) return {};
  const city = restaurant.city.split("·")[0].trim();
  const title = `Dove siamo e orari · ${restaurant.name}`;
  const description = `${restaurant.name}: ${restaurant.address}. Orari, indicazioni e contatti — con ampio parcheggio privato a ${city}.`;
  const og = restaurantOgImage(restaurant.slug);
  const images = og ? [og] : undefined;
  return { title, description, alternates: { canonical: "/dove-siamo" }, openGraph: { type: "website", title, description, siteName: restaurant.name, images }, twitter: { card: "summary_large_image", title, description, images: images?.map((image) => image.url) } };
}

export default async function DoveSiamoPage() {
  const restaurant = await siteRestaurant();
  if (!restaurant) notFound();
  const site = await loadSiteData(restaurant);
  const opening = weeklyOpening(site.schedule);
  const todayDow = new Date().getDay();
  const todayLabel = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"][todayDow];
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(restaurant.address)}&z=15&output=embed`;
  const parking = site.guest.highlight.trim() || site.guest.parkingInfo.trim();

  return <SiteShell restaurant={restaurant} site={site}>
    <section className="mx-auto max-w-6xl px-5 pb-4 pt-16 sm:pt-20">
      <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">Dove siamo</p>
      <h1 className="max-w-3xl text-balance font-heading text-[2.4rem] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-6xl">Ti aspettiamo ad {restaurant.city.split("·")[0].trim()}.</h1>
      <p className="mt-5 flex items-start gap-2.5 text-lg text-white/60"><MapPin className="mt-1 size-5 shrink-0 text-primary" />{restaurant.address}</p>
    </section>

    <section className="mx-auto grid max-w-6xl gap-6 px-5 py-10 lg:grid-cols-[1fr_1.15fr]">
      {/* Contatti */}
      <div className="flex flex-col gap-4">
        <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Contatti</p>
          <div className="mt-5 flex flex-col gap-3">
            <a href={site.directionsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
              <Navigation className="size-4" />Indicazioni stradali
            </a>
            {site.phoneHref && <a href={site.phoneHref} className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-white/12 px-4 text-sm font-medium text-white hover:border-primary/50"><Phone className="size-4 text-primary" />{site.phone}</a>}
            {site.whatsappHref && <a href={site.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-white/12 px-4 text-sm font-medium text-white hover:border-primary/50"><MessageCircle className="size-4 text-primary" />Scrivici su WhatsApp</a>}
          </div>
          {parking && <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-primary/10 p-3.5 text-sm leading-6 text-white/80"><Car className="mt-0.5 size-4 shrink-0 text-primary" />{parking}</p>}
          {site.guest.accessibilityInfo.trim() && <p className="mt-3 flex items-start gap-2.5 text-xs leading-5 text-white/50"><Accessibility className="mt-0.5 size-3.5 shrink-0 text-primary" />{site.guest.accessibilityInfo}</p>}
        </div>

        {/* Orari */}
        <div className="rounded-3xl border border-white/10 bg-card p-6 sm:p-7">
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary"><Clock3 className="size-3.5" />Orari di apertura</p>
          <ul className="mt-4 divide-y divide-white/8">
            {opening.map((row) => <li key={row.day} className={`flex items-center justify-between gap-4 py-2.5 text-sm ${row.day === todayLabel ? "text-white" : "text-white/70"}`}>
              <span className={row.day === todayLabel ? "font-semibold" : ""}>{row.day}{row.day === todayLabel ? " · oggi" : ""}</span>
              <span className="text-right font-mono tabular-nums text-white/80">{row.windows.length > 0 ? row.windows.join(" · ") : <span className="text-white/35">Chiuso</span>}</span>
            </li>)}
          </ul>
        </div>
      </div>

      {/* Mappa */}
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-card">
        <iframe
          title={`Mappa di ${restaurant.name}`}
          src={mapSrc}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full min-h-[360px] w-full lg:min-h-[540px]"
        />
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-5 pb-12">
      <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-primary/20 bg-primary/[0.06] p-8 sm:flex-row sm:items-center sm:p-10">
        <div>
          <h2 className="font-heading text-2xl font-semibold sm:text-3xl">Prima passa a prenotare.</h2>
          <p className="mt-2 text-white/60">Assicurati il tavolo: disponibilità reale e conferma immediata.</p>
        </div>
        <Link href="/prenotazione" className="inline-flex min-h-13 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Prenota un tavolo<ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  </SiteShell>;
}
