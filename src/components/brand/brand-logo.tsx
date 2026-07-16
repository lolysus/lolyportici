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
};

export function BrandLogo({
  className,
  priority = false,
  restaurant,
  name,
  subtitle,
  compact = false,
}: BrandLogoProps) {
  const logoPath = restaurant?.logoPath ?? brandConfig.logoPath;
  const label = name ?? restaurant?.name ?? brandConfig.platformName;
  const supportingText = subtitle ?? (restaurant ? "Prenotazioni e area ospite" : "YUKO × KouSushi");

  return <span aria-label={label} className={cn("inline-flex w-full items-center gap-3 text-current", className)}>
    <span className={cn("relative shrink-0 overflow-hidden rounded-lg border border-current/10 bg-white", compact ? "size-9" : "size-11 sm:size-12")}>
      <Image src={logoPath} alt="" fill sizes={compact ? "36px" : "48px"} priority={priority} unoptimized className="object-contain" />
    </span>
    <span className="min-w-0 leading-none">
      <span className={cn("block truncate font-heading font-semibold tracking-[-0.03em]", compact ? "text-sm" : "text-[0.95rem] sm:text-[1.1rem]")}>{label}</span>
      {!compact && <span className="mt-1.5 block truncate font-mono text-[0.43rem] uppercase tracking-[0.22em] opacity-55 sm:text-[0.5rem]">{supportingText}</span>}
    </span>
  </span>;
}
