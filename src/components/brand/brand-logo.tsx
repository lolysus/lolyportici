import Image from "next/image";
import { brandConfig, type RestaurantLocation } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * I marchi vengono resi così come sono: portano dentro il proprio fondo e il
 * proprio lettering, quindi nessun contenitore, nessuna cornice, nessun nome
 * ripetuto accanto.
 *
 * Il dimensionamento è per altezza, non per larghezza. YUKO è quasi quadrato
 * (1295×1270) e KouSushi è leggermente verticale (250×276): fissando la
 * larghezza uno dei due diventerebbe molto più alto dell'altro e nelle barre
 * l'allineamento salterebbe. Fissando l'altezza restano otticamente pari.
 */
const PLATFORM_LOGO_ASPECT = 520 / 160;

const HEIGHTS = {
  hero: "h-14 sm:h-16",
  default: "h-10 sm:h-11",
  compact: "h-8",
} as const;

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  restaurant?: RestaurantLocation;
  name?: string;
  subtitle?: string;
  compact?: boolean;
  size?: "default" | "hero";
};

export function BrandLogo({
  className,
  priority = false,
  restaurant,
  name,
  subtitle,
  compact = false,
  size = "default",
}: BrandLogoProps) {
  const logoPath = restaurant?.logoPath ?? brandConfig.logoPath;
  const label = name ?? restaurant?.name ?? brandConfig.platformName;
  const aspect = restaurant?.logoAspect ?? PLATFORM_LOGO_ASPECT;
  const isHero = size === "hero";
  const height = compact ? HEIGHTS.compact : isHero ? HEIGHTS.hero : HEIGHTS.default;

  return <span aria-label={label} className={cn("group inline-flex flex-col items-start", className)}>
    <span
      className={cn(
        "relative block overflow-hidden transition-transform duration-300",
        height,
        isHero ? "rounded-xl group-hover:-translate-y-0.5" : "rounded-lg",
      )}
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={logoPath}
        alt=""
        fill
        sizes={isHero ? "80px" : compact ? "36px" : "48px"}
        priority={priority}
        unoptimized
        className="object-contain"
      />
    </span>
    {subtitle && !compact && <span className={cn(
      "mt-2 block max-w-[14rem] truncate font-mono uppercase tracking-[0.22em] opacity-55",
      isHero ? "text-[0.55rem] sm:text-[0.6rem]" : "text-[0.45rem] sm:text-[0.5rem]",
    )}>{subtitle}</span>}
  </span>;
}
