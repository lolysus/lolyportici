import { BrandLogo } from "@/components/brand/brand-logo";
import type { RestaurantLocation } from "@/config/brand";

/**
 * Il posto dove entrerà una foto reale del locale.
 *
 * Finché la foto non c'è, non resta un buco né la scritta "foto in arrivo":
 * è un pannello curato — trama giapponese, bagliore dorato, marchio in
 * filigrana — che regge da solo. Quando arriva la foto, si sostituisce qui.
 */
export function PhotoPanel({ restaurant, label, className = "" }: { restaurant: RestaurantLocation; label: string; className?: string }) {
  return <div className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#17140d] via-[#100f0b] to-[#0b0a08] ${className}`}>
    <div aria-hidden className="absolute -right-16 -top-16 size-64 rounded-full bg-primary/12 blur-3xl" />
    <div aria-hidden className="japanese-pattern absolute inset-0 opacity-40" />
    <div className="relative flex h-full min-h-[220px] flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="opacity-30"><BrandLogo restaurant={restaurant} size="hero" /></span>
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">{label}</span>
    </div>
  </div>;
}
