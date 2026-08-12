"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, Menu, Phone, X } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import type { RestaurantLocation } from "@/config/brand";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/il-ristorante", label: "Il ristorante" },
  { href: "/dove-siamo", label: "Dove siamo" },
];

/**
 * La navigazione del sito. Trasparente in cima, prende un fondo appena si
 * scorre: così l’immagine grande dell’apertura respira, ma i link restano
 * sempre leggibili sopra qualsiasi sfondo.
 */
export function SiteNav({ restaurant, phoneHref }: { restaurant: RestaurantLocation; phoneHref: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Il menu mobile aperto non deve lasciar scorrere la pagina sotto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return <header className={cn(
    "sticky top-0 z-50 transition-colors duration-300",
    scrolled || open ? "border-b border-white/10 bg-background/85 backdrop-blur-xl" : "border-b border-transparent",
  )}>
    <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-5">
      <Link href="/" aria-label={`${restaurant.name} · home`} className="shrink-0 text-white" onClick={() => setOpen(false)}>
        <BrandLogo restaurant={restaurant} priority />
      </Link>

      <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigazione">
        {LINKS.map((link) => <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={cn(
            "relative rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
            isActive(link.href) ? "text-primary" : "text-white/70 hover:text-white",
          )}
        >{link.label}</Link>)}
      </nav>

      <div className="flex items-center gap-2.5">
        {phoneHref && <a href={phoneHref} aria-label={`Chiama ${restaurant.shortName}`} className="hidden size-10 items-center justify-center rounded-full border border-white/15 text-white transition-colors hover:border-primary/60 sm:flex lg:hidden xl:flex"><Phone className="size-4" /></a>}
        <Link href="/prenotazione" className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 sm:inline-flex">
          <CalendarCheck2 className="size-4" />Prenota
        </Link>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={open ? "Chiudi menu" : "Apri menu"} className="flex size-11 items-center justify-center rounded-lg border border-white/15 text-white lg:hidden">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
    </div>

    {open && <div className="lg:hidden">
      <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-5 pb-5 pt-2" aria-label="Navigazione">
        {LINKS.map((link) => <Link
          key={link.href}
          href={link.href}
          onClick={() => setOpen(false)}
          aria-current={isActive(link.href) ? "page" : undefined}
          className={cn(
            "rounded-xl px-4 py-3.5 text-base font-medium transition-colors",
            isActive(link.href) ? "bg-primary/10 text-primary" : "text-white/80 hover:bg-white/5",
          )}
        >{link.label}</Link>)}
        <Link href="/prenotazione" onClick={() => setOpen(false)} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground">
          <CalendarCheck2 className="size-4" />Prenota un tavolo
        </Link>
      </nav>
    </div>}
  </header>;
}
