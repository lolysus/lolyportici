import type { ReactNode } from "react";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";
import type { RestaurantLocation } from "@/config/brand";
import type { SiteData } from "@/lib/site-data";

/**
 * La cornice comune del sito: tema della sede, sfondo scuro con trama, barra di
 * navigazione e piè di pagina. Ogni pagina mette solo il proprio contenuto.
 */
export function SiteShell({ restaurant, site, children }: { restaurant: RestaurantLocation; site: SiteData; children: ReactNode }) {
  return <div
    style={restaurantThemeStyle(restaurant)}
    className={`dark japanese-pattern flex min-h-screen flex-col bg-background text-foreground brand-${restaurant.slug}`}
  >
    <SiteNav restaurant={restaurant} phoneHref={site.phoneHref} />
    <main className="flex-1">{children}</main>
    <SiteFooter restaurant={restaurant} site={site} />
  </div>;
}
