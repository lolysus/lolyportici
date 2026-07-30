import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Building2, CalendarCheck2, Clock3, MapPin, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { brandConfig, managedRestaurants, restaurantConfig } from "@/config/brand";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { hasLocale } from "@/lib/i18n";
import { getBookingPath } from "@/lib/public-url";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { cn } from "@/lib/utils";
import type { ServiceMode } from "@/types/settings";

const copy = {
  it: { eyebrow: "Prenotazioni YUKO × KouSushi", title: "Due identità. Un tavolo scelto con cura.", description: "YUKO ad Ardea e KouSushi a Portici mantengono disponibilità, sala, regole e immagine separate. Scegli il tuo ristorante.", choose: "Prenota in questo ristorante", staff: "Area staff", guests: "Area ospite", restaurants: "Ristoranti gestiti", secure: "Richiesta protetta", journey: { choose: ["Scegli la sede", "Ogni ristorante conserva immagine, sala e disponibilità indipendenti."], personalise: ["Personalizza la richiesta", "Orario, numero di ospiti e preferenze arrivano ordinati allo staff."], confirm: ["Ricevi conferma", "Il percorso guida il cliente fino al riepilogo della prenotazione."] } },
  en: { eyebrow: "YUKO × KouSushi reservations", title: "Two identities. One table chosen with care.", description: "YUKO in Ardea and KouSushi in Portici keep their availability, floor, rules and identity separate.", choose: "Book this restaurant", staff: "Staff area", guests: "Guest area", restaurants: "Managed restaurants", secure: "Secure request", journey: { choose: ["Choose your restaurant", "Each restaurant keeps its own identity, floor plan and availability."], personalise: ["Make it yours", "Time, party size and preferences are sent clearly to the team."], confirm: ["Receive confirmation", "The guided flow ends with a clear booking summary."] } },
  es: { eyebrow: "Reservas YUKO × KouSushi", title: "Dos identidades. Una mesa elegida con cuidado.", description: "YUKO en Ardea y KouSushi en Portici mantienen separadas disponibilidad, sala, reglas e identidad.", choose: "Reservar en este restaurante", staff: "Área del personal", guests: "Área de cliente", restaurants: "Restaurantes gestionados", secure: "Solicitud protegida", journey: { choose: ["Elige el restaurante", "Cada restaurante conserva su identidad, sala y disponibilidad."], personalise: ["Personaliza la solicitud", "Hora, comensales y preferencias llegan ordenados al equipo."], confirm: ["Recibe confirmación", "El flujo guiado termina con un resumen claro de la reserva."] } },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const title = "Scegli il ristorante";
  const description = "Scegli il ristorante e prenota il tuo tavolo online con disponibilità aggiornata in tempo reale.";

  return {
    title,
    description,
    alternates: {
      canonical: getBookingPath(locale),
      languages: Object.fromEntries(restaurantConfig.supportedLocales.map((language) => [language, getBookingPath(language)])),
    },
    openGraph: { type: "website", title, description, url: getBookingPath(locale) },
  };
}

const modeStyle: Record<ServiceMode, { label: string; className: string; dot: string }> = {
  live: { label: "Online", className: "border-emerald-400/20 bg-emerald-400/8 text-emerald-200", dot: "bg-emerald-400" },
  approval: { label: "Su richiesta", className: "border-amber-300/20 bg-amber-300/8 text-amber-100", dot: "bg-amber-300" },
  paused: { label: "Assistenza telefonica", className: "border-rose-300/20 bg-rose-300/8 text-rose-100", dot: "bg-rose-300" },
};

export default async function RestaurantSelectionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const text = copy[locale];
  const restaurants = await Promise.all(managedRestaurants.map(async (restaurant) => ({
    restaurant,
    settings: await getRestaurantSettings(restaurant.id),
  })));

  return <main className="dark min-h-screen bg-background text-foreground">
    <header className="border-b border-white/10 bg-[#080908]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-5">
        <Link href={`/${locale}/book`} aria-label={brandConfig.platformName} className="block w-36 shrink-0 sm:w-44"><BrandLogo priority subtitle="Due ristoranti · una regia" /></Link>
        <nav className="flex items-center gap-3 text-xs" aria-label="Lingua e accesso">
          {restaurantConfig.supportedLocales.map((language) => <Link key={language} href={`/${language}/book`} hrefLang={language} aria-current={language === locale ? "page" : undefined} className={language === locale ? "font-semibold text-white" : "text-white/45 hover:text-white"}>{language.toUpperCase()}</Link>)}
          <Link href="/account" className="ml-2 hidden items-center gap-1.5 text-white/65 hover:text-white sm:inline-flex"><UserRound className="size-3.5" />{text.guests}</Link>
          <Link href="/login" className="border border-white/15 px-3 py-1.5 text-white/70 hover:border-primary/60 hover:text-white">{text.staff}</Link>
        </nav>
      </div>
    </header>

    <section className="japanese-pattern overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <div className="control-rail max-w-4xl pl-5 sm:pl-7">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">{text.eyebrow}</p>
          <h1 className="mt-5 max-w-3xl text-balance font-heading text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl">{text.title}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/55 sm:text-lg">{text.description}</p>
        </div>

        <div className="relative mt-12 grid gap-5 lg:grid-cols-2">
          <div aria-hidden className="service-route absolute left-[22%] right-[22%] top-12 hidden h-px lg:block" />
          {restaurants.map(({ restaurant, settings }, index) => {
            const mode = modeStyle[settings.operations.serviceMode];
            return <article key={restaurant.id} style={restaurantThemeStyle(restaurant)} className="surface-3d-dark group relative z-10 overflow-hidden rounded-xl border border-white/10 border-t-2 border-t-primary bg-card">
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <BrandLogo restaurant={restaurant} priority={index === 0} compact className="max-w-[180px]" />
                  <Badge variant="outline" className={cn("gap-2 rounded-sm", mode.className)}><span className={cn("size-1.5 rounded-full", settings.operations.serviceMode === "live" && "signal-pulse", mode.dot)} />{mode.label}</Badge>
                </div>
                <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Ristorante 0{index + 1}</p>
                <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{restaurant.name}</h2>
                <p className="mt-2 text-sm text-white/40">Brand, prenotazioni e regole operative indipendenti</p>
                <dl className="mt-6 space-y-3 text-sm text-white/55">
                  <div className="flex gap-3"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /><span>{restaurant.address}</span></div>
                  <div className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><span>{restaurant.serviceNote}</span></div>
                  {restaurant.phoneHref ? <div className="flex gap-3"><Phone className="mt-0.5 size-4 shrink-0 text-primary" /><a href={restaurant.phoneHref} className="hover:text-primary">{restaurant.phone}</a></div> : null}
                </dl>
              </div>
              <a href={`/${locale}/book/${restaurant.slug}`} className="group/link flex items-center justify-between border-t border-white/8 bg-white/[0.02] px-6 py-5 font-medium text-white transition-colors hover:bg-primary/10 sm:px-8">
                <span>{text.choose}</span><ArrowRight className="size-4 text-primary transition-transform group-hover/link:translate-x-1" />
              </a>
            </article>;
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-white/38">
          <span className="inline-flex items-center gap-2"><Building2 className="size-3.5 text-primary" />{managedRestaurants.length} {text.restaurants}</span>
          <span className="inline-flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" />{text.secure}</span>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
          <JourneyItem index="01" icon={Building2} title={text.journey.choose[0]} description={text.journey.choose[1]} />
          <JourneyItem index="02" icon={Sparkles} title={text.journey.personalise[0]} description={text.journey.personalise[1]} />
          <JourneyItem index="03" icon={CalendarCheck2} title={text.journey.confirm[0]} description={text.journey.confirm[1]} />
        </div>
      </div>
    </section>
  </main>;
}

function JourneyItem({ index, icon: Icon, title, description }: { index: string; icon: typeof Building2; title: string; description: string }) {
  return <div className="group bg-[#0b0d0b]/92 px-5 py-5 transition-colors hover:bg-white/[0.055] sm:px-6">
    <div className="flex items-center justify-between"><Icon className="size-4 text-primary" /><span className="font-mono text-[10px] tracking-[0.2em] text-white/35">{index}</span></div>
    <h2 className="mt-5 font-heading text-lg font-semibold tracking-tight text-white">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-white/48">{description}</p>
  </div>;
}
