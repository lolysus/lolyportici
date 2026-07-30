import Image from "next/image";
import { brandConfig, type RestaurantLocation } from "@/config/brand";
import { cn } from "@/lib/utils";

/**
 * I tre marchi sono disegnati come banner 640×280 e portano dentro di sé
 * il proprio fondo arrotondato e il proprio lettering. Vanno quindi resi
 * alla loro proporzione naturale, senza contenitore: incorniciarli produce
 * una seconda cornice sopra la prima, e ripetere il nome accanto all'arte
 * lo scrive due volte.
 */
const LOGO_ASPECT = "640 / 280";

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
  const isHero = size === "hero";

  return <span aria-label={label} className={cn("group inline-flex w-full flex-col", className)}>
    <span
      className={cn(
        "relative block w-full overflow-hidden transition-transform duration-300",
        isHero ? "rounded-2xl group-hover:-translate-y-0.5" : "rounded-xl",
      )}
      style={{ aspectRatio: LOGO_ASPECT }}
    >
      <Image
        src={logoPath}
        alt=""
        fill
        sizes={isHero ? "(max-width: 640px) 260px, 360px" : compact ? "200px" : "280px"}
        priority={priority}
        unoptimized
        className="object-contain"
      />
    </span>
    {subtitle && !compact && <span className={cn(
      "mt-2.5 block truncate font-mono uppercase tracking-[0.22em] opacity-55",
      isHero ? "text-[0.55rem] sm:text-[0.62rem]" : "text-[0.45rem] sm:text-[0.5rem]",
    )}>{subtitle}</span>}
  </span>;
}
