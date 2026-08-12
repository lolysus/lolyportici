import Link from "next/link";
import { CalendarCheck2, ExternalLink, MapPin, MessageCircle, Phone } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { RestaurantLocation } from "@/config/brand";
import type { SiteData } from "@/lib/site-data";

export function SiteFooter({ restaurant, site }: { restaurant: RestaurantLocation; site: SiteData }) {
  const year = new Date().getFullYear();
  return <footer className="mt-24 border-t border-white/10 bg-[#0c0b09]">
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <span className="block text-white"><BrandLogo restaurant={restaurant} /></span>
        <p className="mt-5 max-w-xs text-sm leading-6 text-white/55">{restaurant.serviceNote}. Prenotazione online con disponibilità in tempo reale.</p>
        <Link href="/prenotazione" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          <CalendarCheck2 className="size-4" />Prenota un tavolo
        </Link>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Dove siamo</p>
        <ul className="mt-4 space-y-3 text-sm text-white/70">
          <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{restaurant.address}</li>
          {site.phoneHref && <li><a href={site.phoneHref} className="flex items-center gap-2.5 hover:text-white"><Phone className="size-4 shrink-0 text-primary" />{site.phone}</a></li>}
          {site.whatsappHref && <li><a href={site.whatsappHref} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-white"><MessageCircle className="size-4 shrink-0 text-primary" />WhatsApp</a></li>}
          <li><a href={site.directionsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 hover:text-white"><ExternalLink className="size-4 shrink-0 text-primary" />Indicazioni su Google Maps</a></li>
        </ul>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Il ristorante</p>
        <ul className="mt-4 space-y-2.5 text-sm text-white/70">
          <li><Link href="/" className="hover:text-white">Home</Link></li>
          <li><Link href="/il-ristorante" className="hover:text-white">Il ristorante</Link></li>
          <li><Link href="/dove-siamo" className="hover:text-white">Dove siamo e orari</Link></li>
          <li><Link href="/prenotazione" className="hover:text-white">Prenota</Link></li>
        </ul>
        {(site.instagramUrl || site.officialWebsite) && <div className="mt-5 flex flex-wrap gap-3 text-sm">
          {site.instagramUrl && <a href={site.instagramUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">Instagram<ExternalLink className="size-3.5" /></a>}
          {site.officialWebsite && <a href={site.officialWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white">Sito ufficiale<ExternalLink className="size-3.5" /></a>}
        </div>}
      </div>
    </div>

    <div className="border-t border-white/8">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
        <p>© {year} {restaurant.legalName}{site.hasVatNumber ? ` · P.IVA ${restaurant.vatNumber}` : ""}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/it/privacy" className="hover:text-white/70">Privacy</Link>
          <Link href="/it/terms" className="hover:text-white/70">Condizioni</Link>
        </div>
      </div>
    </div>
  </footer>;
}
