import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarCheck2, Car, Leaf, MapPin } from "lucide-react";
import { BookingWizard } from "@/components/public-booking/booking-wizard";
import { SiteShell } from "@/components/site/site-shell";
import { siteRestaurant } from "@/lib/site-host";
import { loadSiteData } from "@/lib/site-data";
import { restaurantOgImage } from "@/lib/og-image";
import { loadBookingPageData } from "@/lib/booking-page-data";

export async function generateMetadata(): Promise<Metadata> {
  const restaurant = await siteRestaurant();
  if (!restaurant) return {};
  const city = restaurant.city.split("·")[0].trim();
  const title = `Prenota un tavolo · ${restaurant.name}`;
  const description = `Prenota online da ${restaurant.name} a ${city}: scegli data, orario e numero di persone. Disponibilità in tempo reale e conferma immediata.`;
  const og = restaurantOgImage(restaurant.slug);
  const images = og ? [og] : undefined;
  return { title, description, alternates: { canonical: "/prenotazione" }, openGraph: { type: "website", title, description, siteName: restaurant.name, images }, twitter: { card: "summary_large_image", title, description, images: images?.map((image) => image.url) } };
}

export default async function PrenotazionePage() {
  const restaurant = await siteRestaurant();
  if (!restaurant) notFound();
  const [site, data] = await Promise.all([loadSiteData(restaurant), loadBookingPageData(restaurant, "it")]);

  const bookingLocation = { ...restaurant, phone: data.contactPhone, phoneHref: data.contactPhoneHref, whatsappHref: data.contactWhatsappHref };
  const infoChips = [
    site.guest.parkingInfo.trim() ? { icon: Car, text: site.guest.highlight.trim() || "Parcheggio disponibile" } : null,
    { icon: Leaf, text: "Segnala allergie in prenotazione" },
    { icon: MapPin, text: restaurant.city.split("·")[0].trim() },
  ].filter(Boolean) as { icon: typeof Car; text: string }[];

  return <SiteShell restaurant={restaurant} site={site}>
    <section className="relative overflow-hidden border-b border-white/8">
      <div aria-hidden className="pointer-events-none absolute -left-32 top-[-20%] size-[26rem] rounded-full bg-primary/10 blur-[110px]" />
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
          <CalendarCheck2 className="size-3.5" />Prenotazione online
        </p>
        <h1 className="max-w-2xl text-balance font-heading text-4xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-6xl">Prenota il tuo tavolo</h1>
        <p className="mt-4 max-w-xl text-lg leading-7 text-white/60">{site.guest.arrivalMessage || "Scegli data, orario e numero di persone: la disponibilità è aggiornata in tempo reale."}</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          {infoChips.map((chip) => <span key={chip.text} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-3.5 py-2 text-sm text-white/70">
            <chip.icon className="size-4 text-primary" />{chip.text}
          </span>)}
        </div>
      </div>
    </section>

    <BookingWizard dictionary={data.dictionary} locale="it" location={bookingLocation} features={data.features} />
  </SiteShell>;
}
