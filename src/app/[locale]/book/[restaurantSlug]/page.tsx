import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Accessibility, CalendarCheck2, Car, Clock3, ExternalLink, Leaf, MapPinned, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles, UserRound, UsersRound, Utensils } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { BookingWizard } from "@/components/public-booking/booking-wizard";
import { RestaurantBookingJsonLd } from "@/components/seo/restaurant-booking-json-ld";
import { Badge } from "@/components/ui/badge";
import { brandConfig, getRestaurantLocationBySlug, restaurantConfig } from "@/config/brand";
import { getDictionary, hasLocale } from "@/lib/i18n";
import { dateKeyInZone, localDateTimeToUtc } from "@/lib/datetime";
import { getBookingPath, getGoogleMapsDirectionsUrl, getRequestUrl } from "@/lib/public-url";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import { buildPhoneHref, buildWhatsappHref } from "@/lib/contact";
import { restaurantOgImage } from "@/lib/og-image";
import { cn } from "@/lib/utils";
import { buildServiceTimeSlots, dayOfWeekForDateKey } from "@/lib/service-calendar";
import { getRestaurantSettings } from "@/domains/settings/settings-service";
import { getRepository } from "@/repositories";

const bookingTrustCopy = {
  it: [
    { icon: UserRound, label: "Senza account", detail: "Accesso immediato" },
    { icon: Phone, label: "Dati essenziali", detail: "Nome, cognome e cellulare" },
    { icon: UsersRound, label: "Persone obbligatorie", detail: "Capienza corretta" },
  ],
  en: [
    { icon: UserRound, label: "No account", detail: "Start immediately" },
    { icon: Phone, label: "Essential details", detail: "Name, surname and phone" },
    { icon: UsersRound, label: "Guest count required", detail: "Accurate capacity" },
  ],
  es: [
    { icon: UserRound, label: "Sin cuenta", detail: "Acceso inmediato" },
    { icon: Phone, label: "Datos esenciales", detail: "Nombre, apellidos y telefono" },
    { icon: UsersRound, label: "Personas obligatorias", detail: "Aforo correcto" },
  ],
} as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; restaurantSlug: string }> }): Promise<Metadata> {
  const { locale, restaurantSlug } = await params;
  const location = getRestaurantLocationBySlug(restaurantSlug);
  if (!location || !hasLocale(locale)) return {};
  const title = `Prenota ${location.name}`;
  const description = `Prenota online da ${location.name}, ${location.city}. Disponibilità aggiornata in tempo reale e conferma sicura.`;
  // Absolute, built from the request's real host: on a dedicated domain this
  // must point at that domain, not at whichever URL happens to be configured
  // as the shared fallback.
  const canonical = await getRequestUrl(getBookingPath(locale, location));
  const languages = await Promise.all(restaurantConfig.supportedLocales.map(async (language) => [language, await getRequestUrl(getBookingPath(language, location))] as const));

  const og = restaurantOgImage(location.slug);
  const images = og ? [og] : undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: Object.fromEntries(languages),
    },
    openGraph: { type: "website", title, description, siteName: brandConfig.platformName, url: canonical, images },
    twitter: { card: "summary_large_image", title, description, images: images?.map((image) => image.url) },
  };
}

export default async function BookingPage({ params }: { params: Promise<{ locale: string; restaurantSlug: string }> }) {
  const { locale, restaurantSlug } = await params;
  const location = getRestaurantLocationBySlug(restaurantSlug);
  if (!hasLocale(locale) || !location) notFound();
  const [dictionary, settings, availabilityContext] = await Promise.all([getDictionary(locale), getRestaurantSettings(location.id), getRepository(location.id).getAvailabilityContext()]);
  const bookingStatus = settings.operations.serviceMode === "live"
    ? { label: "Live", dot: "bg-emerald-400", message: "Disponibilità sincronizzata in tempo reale" }
    : settings.operations.serviceMode === "approval"
      ? { label: "Su richiesta", dot: "bg-amber-300", message: "Richieste verificate personalmente dallo staff" }
      : { label: "In pausa", dot: "bg-rose-300", message: "Prenotazioni assistite telefonicamente" };
  const now = availabilityContext.now ?? new Date();
  const firstDate = dateKeyInZone(now, availabilityContext.timezone);
  const enabledWeekdays = availabilityContext.locationAvailable === false ? [] : [...new Set(availabilityContext.servicePeriods.filter((service) => service.isActive && service.onlineBookingEnabled).map((service) => service.dayOfWeek))];
  const closedDates = availabilityContext.closures.filter((closure) => closure.type !== "opening" && !closure.affectedAreaId && !closure.affectedTableId && !closure.startTime && !closure.endTime).map((closure) => closure.date);
  const onlineServicesToday = availabilityContext.servicePeriods.filter((service) => service.isActive && service.onlineBookingEnabled && service.dayOfWeek === dayOfWeekForDateKey(firstDate));
  const hasTimeAfterNotice = onlineServicesToday.some((service) => {
    const lastStart = localDateTimeToUtc(firstDate, service.endTime, availabilityContext.timezone).getTime() - settings.durations.party1To2 * 60_000;
    return buildServiceTimeSlots(service).some((time) => {
      const start = localDateTimeToUtc(firstDate, time, availabilityContext.timezone).getTime();
      return start >= now.getTime() + settings.policies.minimumNoticeMinutes * 60_000 && start <= lastStart;
    });
  });
  if (onlineServicesToday.length > 0 && !hasTimeAfterNotice) closedDates.push(firstDate);
  const directionsUrl = getGoogleMapsDirectionsUrl(location.address);
  const bookingPath = getBookingPath(locale, location);
  // I recapiti vengono dalle impostazioni della sede (modificabili dal
  // ristoratore), con il valore di partenza come rete di sicurezza se il
  // campo non è mai stato compilato.
  const contactPhone = settings.contact.phone || location.phone;
  const contactPhoneHref = buildPhoneHref(settings.contact.phone) || location.phoneHref;
  const contactWhatsappHref = buildWhatsappHref(settings.contact.whatsapp, settings.contact.whatsappMessage, location.shortName) || location.whatsappHref;
  const bookingUrl = await getRequestUrl(bookingPath);
  const officialWebsite = settings.contact.officialWebsite || location.officialWebsite;
  const instagramUrl = settings.contact.instagramUrl || location.instagramUrl;
  const hasPhone = Boolean(contactPhoneHref);
  // Meglio nessuna partita IVA che una scritta "In aggiornamento" nel footer.
  const hasVatNumber = /^\d{11}$/.test(location.vatNumber.replace(/\s/g, ""));
  const bookingTrust = bookingTrustCopy[locale as keyof typeof bookingTrustCopy];
  const highlight = settings.guestExperience.highlight.trim();
  return <div style={restaurantThemeStyle(location)} className={`dark japanese-pattern min-h-screen bg-background brand-${location.slug}`}>
    <RestaurantBookingJsonLd restaurant={location} bookingUrl={bookingUrl} />
    <a href="#booking-content" className="sr-only fixed left-4 top-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only">Vai alla prenotazione</a>
    <header className="border-b border-foreground/10 bg-[#111] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4">
        <Link href={bookingPath} aria-label={`${location.name} · prenotazioni online`} className="block shrink-0 text-white"><BrandLogo priority size="hero" restaurant={location} subtitle="Prenotazioni online" /></Link>
        <nav className="flex items-center gap-1 text-xs sm:gap-3" aria-label="Lingua e accesso">
          <Badge variant="outline" className="hidden border-white/20 bg-white/5 text-white sm:inline-flex"><span className={`mr-1.5 size-1.5 rounded-full ${bookingStatus.dot}`} />{bookingStatus.label}</Badge>
          {/* Niente "Area ospite": chi ha prenotato riceve il proprio link nella
              schermata di conferma, e un ingresso generico su questa pagina era
              l'unico punto della piattaforma che cercava fra i due ristoranti. */}
          {restaurantConfig.supportedLocales.map((language) => <Link key={language} href={`/${language}/book/${restaurantSlug}`} hrefLang={language} aria-current={language === locale ? "page" : undefined} className={cn("inline-flex min-h-11 items-center justify-center rounded-md px-2 transition-colors sm:px-3", language === locale ? "bg-white/10 font-semibold text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}>{language.toUpperCase()}</Link>)}
        </nav>
      </div>
    </header>
    <div className="sticky top-0 z-40 border-b border-white/10 bg-[#0c0d0c]/95 px-5 py-2.5 text-white backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl gap-3"><a href="#booking-content" className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-primary px-4 text-sm font-semibold text-primary-foreground"><CalendarCheck2 className="size-4" />Inizia la prenotazione</a><a href={directionsUrl} target="_blank" rel="noreferrer" aria-label={`Apri ${location.name} in Google Maps`} className="flex size-11 shrink-0 items-center justify-center border border-white/20 text-white"><MapPinned className="size-4 text-primary" /></a></div>
    </div>
    <section className="booking-hero relative overflow-hidden border-b border-white/10 bg-[#111] text-white">
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,.9fr)] lg:items-center lg:py-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/75">
            <span className="signal-pulse size-1.5 rounded-full bg-primary" />
            {bookingStatus.message}
          </div>
          {/* Occhiello e titolo si possono personalizzare dal pannello: se il
              ristoratore ha scritto un testo suo vince, altrimenti resta quello
              predefinito della lingua. */}
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">{settings.guestExperience.heroEyebrow.trim() || dictionary.booking.eyebrow}</p>
          {/* Su telefono il titolo occupava quasi tutto il primo schermo e il
              modulo restava fuori vista: qui pesa meno e lascia salire il
              resto. */}
          <h1 className="max-w-3xl text-balance font-heading text-[2.15rem] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-6xl sm:leading-[1.02] lg:text-7xl">{settings.guestExperience.heroTitle.trim() || dictionary.booking.title}</h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 text-white/58 sm:mt-5 sm:text-lg sm:leading-7">{settings.guestExperience.arrivalMessage}</p>
          {highlight ? <p className="mt-5 flex max-w-xl items-center gap-3 border-l-[3px] border-primary bg-primary/10 py-3 pl-3.5 pr-4 text-[15px] font-semibold leading-6 text-white sm:mt-6 sm:pl-4 sm:pr-5 sm:text-lg">
            <Car className="size-5 shrink-0 text-primary" aria-hidden />
            <span className="underline decoration-primary decoration-2 underline-offset-4">{highlight}</span>
          </p> : null}
          <div className="mt-7 hidden flex-wrap gap-3 lg:flex">
            <a href="#booking-content" className="inline-flex min-h-12 items-center gap-2 bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"><CalendarCheck2 className="size-4" />Inizia la prenotazione</a>
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 border border-white/15 bg-white/[0.03] px-5 text-sm font-medium text-white transition-colors hover:border-primary/55 hover:bg-white/[0.07]"><MapPinned className="size-4 text-primary" />Come arrivare<ExternalLink className="size-3" /></a>
          </div>
          <div className="booking-trust-rail mt-8 grid max-w-xl grid-cols-3 gap-2" aria-label="Prenotazione semplice e sicura">
            {bookingTrust.map((item) => <div key={item.label} className="booking-trust-card"><item.icon className="size-4 text-primary" /><p>{item.label}</p><span>{item.detail}</span></div>)}
          </div>
          <div className="mt-8 flex flex-col gap-x-6 gap-y-1 text-sm text-white/60 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="inline-flex items-start gap-2 py-1.5"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{location.city} · {location.address}</span>
            <span className="inline-flex items-center gap-2 py-1.5"><Clock3 className="size-4 shrink-0 text-primary" />{location.serviceNote}</span>
            {hasPhone ? <a href={contactPhoneHref} className="inline-flex min-h-11 items-center gap-2 font-medium text-white hover:text-primary"><Phone className="size-4 shrink-0 text-primary" />{contactPhone}</a> : null}
            {contactWhatsappHref ? <a href={contactWhatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium text-white hover:text-primary"><MessageCircle className="size-4 shrink-0 text-primary" />WhatsApp</a> : null}
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-medium text-white hover:text-primary"><MapPinned className="size-4 shrink-0 text-primary" />Google Maps<ExternalLink className="size-3" /></a>
          </div>
        </div>

        <div className="booking-constellation perspective-stage hidden lg:block" aria-label="Il percorso della prenotazione">
          <div className="booking-route-card depth-card surface-3d-dark relative overflow-hidden rounded-xl border border-white/10 bg-[#111311] p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/38">{location.shortName}</p><p className="mt-2 font-heading text-2xl">Il tavolo, senza attese.</p></div>
              <span className="flex size-11 items-center justify-center border border-primary/30 bg-primary/10 text-primary"><Utensils className="size-5" /></span>
            </div>
            <div className="relative mt-8 grid grid-cols-3 gap-3">
              <div aria-hidden className="service-route absolute left-[16%] right-[16%] top-5 h-px" />
              {[
                { icon: CalendarCheck2, label: "Richiesta" },
                { icon: Sparkles, label: "Tavolo" },
                { icon: ShieldCheck, label: "Conferma" },
              ].map((item, index) => <div key={item.label} className="relative z-10 text-center"><span className="mx-auto flex size-10 items-center justify-center rounded-full border border-white/12 bg-[#20211f] text-primary"><item.icon className="size-4" /></span><p className="mt-3 text-xs font-medium text-white/75">{item.label}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-white/28">0{index + 1}</p></div>)}
            </div>
            <div className="mt-7 flex items-center justify-between border border-white/8 bg-white/[0.035] px-4 py-3 text-xs"><span className="text-white/45">Tempo medio</span><span className="font-mono font-semibold text-primary">meno di 2 min</span></div>
          </div>
        </div>
      </div>
    </section>
    <section className="border-b border-foreground/10 bg-card" aria-label="Informazioni per l’arrivo">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border lg:grid-cols-4">
        <GuestInfo icon={MapPinned} label="Come arrivare" text={settings.guestExperience.directions} />
        <GuestInfo icon={Car} label="Parcheggio" text={settings.guestExperience.parkingInfo} />
        <GuestInfo icon={Accessibility} label="Accessibilità" text={settings.guestExperience.accessibilityInfo} />
        <GuestInfo icon={Leaf} label="Allergie" text={settings.guestExperience.dietaryNotice} />
      </div>
    </section>
    <BookingWizard dictionary={dictionary} locale={locale} location={{ ...location, phone: contactPhone, phoneHref: contactPhoneHref, whatsappHref: contactWhatsappHref }} features={{ onlineBookingEnabled: settings.operations.serviceMode !== "paused" && settings.service.onlineBookingEnabled && availabilityContext.locationAvailable !== false, waitlistEnabled: settings.features.waitlistEnabled, minimumPartySize: settings.rules.minimumPartySize, maximumPartySize: settings.rules.maximumPartySize, requiresManualApproval: settings.rules.requiresManualApproval || settings.operations.serviceMode === "approval", requiresDeposit: settings.rules.requiresDeposit, depositAmount: settings.rules.depositAmount, minimumNoticeMinutes: settings.policies.minimumNoticeMinutes, punctualityNotice: settings.guestExperience.punctualityNotice, calendarRules: { firstDate, maximumAdvanceDays: settings.policies.maximumAdvanceDays, enabledWeekdays, closedDates: [...new Set(closedDates)] } }} />
    <footer className="border-t border-foreground/10"><div className="mx-auto grid max-w-6xl gap-6 px-5 pb-28 pt-8 text-xs text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end sm:py-8"><div><p className="font-medium text-foreground">© {new Date().getFullYear()} {location.legalName}</p><p className="mt-2">{location.address}{hasVatNumber ? ` · P.IVA ${location.vatNumber}` : ""}</p></div><div className="-mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:justify-end">{hasPhone ? <a href={contactPhoneHref} className="inline-flex min-h-11 items-center px-2">{contactPhone}</a> : null}{contactWhatsappHref ? <a href={contactWhatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2">WhatsApp</a> : null}{officialWebsite ? <a href={officialWebsite} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 px-2">Sito ufficiale<ExternalLink className="size-3" /></a> : null}{instagramUrl ? <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1 px-2">Instagram<ExternalLink className="size-3" /></a> : null}<Link href={`/${locale}/privacy`} className="inline-flex min-h-11 items-center px-2">Privacy</Link><Link href={`/${locale}/terms`} className="inline-flex min-h-11 items-center px-2">Condizioni</Link></div></div></footer>
  </div>;
}

function GuestInfo({ icon: Icon, label, text }: { icon: typeof MapPinned; label: string; text: string }) {
  return <div className="bg-card px-5 py-5"><p className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}</p><p className="mt-2 text-xs leading-5 text-foreground/75">{text}</p></div>;
}
