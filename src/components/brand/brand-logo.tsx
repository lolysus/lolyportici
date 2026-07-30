import Image from "next/image";
import { brandConfig, type RestaurantLocation } from "@/config/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  restaurant?: RestaurantLocation;
  name?: string;
  subtitle?: string;
  compact?: boolean;
  /**
   * "hero" porta il marchio a dimensione insegna. Serve dove il logo è la
   * prima cosa che il cliente deve riconoscere, non un elemento di corredo.
   */
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
  const supportingText = subtitle ?? (restaurant ? "Prenotazioni e area ospite" : brandConfig.platformName);
  const usesRestaurantMark = Boolean(restaurant);
  const isHero = size === "hero";

  return <span aria-label={label} className={cn("group inline-flex w-full items-center text-current", isHero ? "gap-4" : "gap-3", className)}>
    <span className={cn(
      "relative shrink-0 overflow-hidden bg-white ring-1 ring-current/10 transition-[transform,box-shadow] duration-300 group-hover:-translate-y-0.5",
      isHero ? "rounded-2xl shadow-[0_10px_30px_-12px_rgba(0,0,0,.7)] group-hover:shadow-[0_16px_40px_-14px_rgba(0,0,0,.85)]" : "rounded-lg",
      usesRestaurantMark
        ? (isHero ? "size-16 sm:size-20" : compact ? "size-9" : "size-12 sm:size-14")
        : (compact ? "h-8 w-14" : "h-10 w-[4.35rem] sm:h-11 sm:w-20"),
    )}>
      <Image
        src={logoPath}
        alt=""
        fill
        sizes={usesRestaurantMark ? (isHero ? "80px" : compact ? "36px" : "56px") : (compact ? "56px" : "80px")}
        priority={priority}
        unoptimized
        className={cn("object-contain", isHero ? "p-2" : "p-1")}
      />
    </span>
    <span className="min-w-0 leading-none">
      <span className={cn(
        "block truncate font-heading font-semibold tracking-[-0.03em]",
        isHero ? "text-xl sm:text-2xl" : compact ? "text-sm" : "text-base sm:text-[1.15rem]",
      )}>{label}</span>
      {!compact && <span className={cn(
        "mt-2 block truncate font-mono uppercase tracking-[0.22em] opacity-60",
        isHero ? "text-[0.55rem] sm:text-[0.62rem]" : "text-[0.45rem] sm:text-[0.52rem]",
      )}>{supportingText}</span>}
    </span>
  </span>;
}
