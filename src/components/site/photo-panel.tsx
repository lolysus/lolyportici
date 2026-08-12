import Image from "next/image";
import { BrandLogo } from "@/components/brand/brand-logo";
import type { RestaurantLocation } from "@/config/brand";
import { sitePhotos, type SitePhotoName } from "@/lib/site-photos";

/**
 * Un riquadro fotografico del locale.
 *
 * Con `photo` mostra la foto reale — cornice dorata, velo scuro in basso e una
 * didascalia leggibile — con zoom morbido al passaggio del mouse. Senza `photo`
 * resta il pannello curato (trama giapponese, marchio in filigrana) che regge
 * da solo: nessun buco, nessuna scritta "foto in arrivo".
 */
export function PhotoPanel({
  restaurant,
  label,
  photo,
  className = "",
  priority = false,
}: {
  restaurant: RestaurantLocation;
  label: string;
  photo?: SitePhotoName;
  className?: string;
  priority?: boolean;
}) {
  if (photo && sitePhotos[photo]) {
    const img = sitePhotos[photo];
    return (
      <figure className={`group gold-frame relative overflow-hidden rounded-3xl ${className}`}>
        <Image
          src={img.src}
          alt={`${restaurant.shortName} — ${label}`}
          fill
          priority={priority}
          sizes="(max-width: 1024px) 100vw, 50vw"
          placeholder="blur"
          blurDataURL={img.blurDataURL}
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
        <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-5">
          <span className="h-px w-6 bg-primary" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/80">{label}</span>
        </figcaption>
      </figure>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#17140d] via-[#100f0b] to-[#0b0a08] ${className}`}>
      <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/12 blur-3xl" />
      <div aria-hidden className="japanese-pattern absolute inset-0 opacity-40" />
      <div className="relative flex h-full min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="opacity-30"><BrandLogo restaurant={restaurant} size="hero" /></span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</span>
      </div>
    </div>
  );
}
