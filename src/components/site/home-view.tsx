import Link from "next/link";
import { ArrowRight, Car, Clock3, MapPin, MessageCircle, Phone, Sparkles, UsersRound } from "lucide-react";
import { PhotoPanel } from "@/components/site/photo-panel";
import { CinematicHero } from "@/components/site/cinematic-hero";
import { DishGallery } from "@/components/site/dish-gallery";
import { Reveal } from "@/components/site/reveal";
import { sitePhotos } from "@/lib/site-photos";
import type { RestaurantLocation } from "@/config/brand";
import type { SiteData } from "@/lib/site-data";

export function HomeView({ restaurant, site }: { restaurant: RestaurantLocation; site: SiteData }) {
  const city = restaurant.city.split("·")[0].trim();
  const parking = site.guest.highlight.trim() || site.guest.parkingInfo.trim();
  // Le foto reali sono di YUKO: si mostrano solo sul suo sito. Altrove restano i
  // pannelli brandizzati, così un'eventuale seconda vetrina non eredita piatti altrui.
  const hasPhotos = restaurant.slug === "yuko";

  const highlights = [
    parking ? { icon: Car, title: parking, note: "Arrivi e posteggi senza pensieri" } : null,
    { icon: UsersRound, title: `Sala interna e ${site.seating.outdoor > 0 ? "terrazza" : "spazi curati"}`, note: site.seating.outdoor > 0 ? `${site.seating.indoor} posti dentro · ${site.seating.outdoor} all’aperto` : `${site.seating.indoor} posti` },
    { icon: Clock3, title: "Prenotazione online immediata", note: "Disponibilità reale, conferma in un minuto" },
  ].filter(Boolean) as { icon: typeof Car; title: string; note: string }[];

  return <>
    {/* ── Apertura cinematografica ─────────────────────────────────────── */}
    <section className="relative flex min-h-[86svh] items-end overflow-hidden lg:min-h-[92svh]">
      {hasPhotos ? (
        <CinematicHero videoSrc="/videos/atmosfera-1.mp4" poster={sitePhotos["interno-scala"]} />
      ) : (
        <>
          <div aria-hidden className="pointer-events-none absolute -left-40 top-[-10%] size-[34rem] rounded-full bg-primary/10 blur-[120px]" />
          <div aria-hidden className="pointer-events-none absolute right-[-10%] top-1/3 size-[26rem] rounded-full bg-primary/5 blur-[120px]" />
        </>
      )}
      <div className="relative mx-auto w-full max-w-6xl px-5 pb-16 pt-28 lg:pb-24">
        <Reveal>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-black/30 px-3.5 py-1.5 text-xs font-medium text-primary backdrop-blur">
            <Sparkles className="size-3.5" />{restaurant.shortName} · {restaurant.serviceNote.split("·")[0].trim()} · {city}
          </p>
          <h1 className="max-w-3xl text-balance font-heading text-[2.9rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-8xl">
            <span className="text-gold-sheen">Il Giappone,</span><br />servito con cura.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-7 text-white/70">
            Cucina giapponese e fusion in un ambiente curato ad {city}, con ampio parcheggio privato e prenotazione online immediata.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/prenotazione" className="inline-flex min-h-13 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:-translate-y-0.5">
              Prenota un tavolo<ArrowRight className="size-4" />
            </Link>
            <Link href="/dove-siamo" className="inline-flex min-h-13 items-center gap-2 rounded-full border border-white/20 bg-black/25 px-6 text-base font-medium text-white backdrop-blur transition-colors hover:border-primary/50 hover:bg-black/40">
              <MapPin className="size-4 text-primary" />Come arrivare
            </Link>
          </div>
        </Reveal>
      </div>
    </section>

    {/* ── Punti di forza ───────────────────────────────────────────────── */}
    <section className="border-y border-white/8 bg-white/[0.015]">
      <div className="mx-auto grid max-w-6xl gap-px overflow-hidden bg-white/8 sm:grid-cols-3">
        {highlights.map((item, i) => <Reveal key={item.title} delay={i * 80} className="bg-background px-6 py-8">
          <item.icon className="size-5 text-primary" />
          <p className="mt-4 text-lg font-semibold leading-tight">{item.title}</p>
          <p className="mt-1.5 text-sm leading-6 text-white/50">{item.note}</p>
        </Reveal>)}
      </div>
    </section>

    {/* ── Le specialità ────────────────────────────────────────────────── */}
    {hasPhotos && <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
      <Reveal className="max-w-2xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">Le specialità</p>
        <h2 className="text-balance font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Piatti che si fanno ricordare.</h2>
        <p className="mt-4 leading-7 text-white/60">Sushi e cucina fusion preparati al momento. Una selezione di ciò che esce dalla nostra cucina.</p>
      </Reveal>
      <DishGallery />
    </section>}

    {/* ── Il locale ────────────────────────────────────────────────────── */}
    <section className="border-t border-white/8 bg-white/[0.015]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <Reveal className="order-2 lg:order-1">
          <PhotoPanel restaurant={restaurant} label="L’atmosfera" photo={hasPhotos ? "tavola-brand" : undefined} className="min-h-[360px] lg:min-h-[480px]" />
        </Reveal>
        <Reveal delay={120} className="order-1 lg:order-2">
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">Il ristorante</p>
          <h2 className="max-w-md text-balance font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Un rito quotidiano, fatto bene.</h2>
          <p className="mt-5 max-w-lg leading-7 text-white/60">
            Da {restaurant.shortName} il sushi incontra la cucina fusion in piatti preparati con attenzione, in una sala pensata per stare comodi — a pranzo come a cena.
            {site.seating.outdoor > 0 ? " Quando il tempo lo permette, c’è anche lo spazio all’aperto." : ""}
          </p>
          <Link href="/il-ristorante" className="mt-7 inline-flex items-center gap-2 text-base font-semibold text-primary hover:underline underline-offset-4">
            Scopri il ristorante<ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </div>
    </section>

    {/* ── Come si prenota ──────────────────────────────────────────────── */}
    <section className="mx-auto max-w-6xl px-5 py-20 lg:py-24">
      <Reveal className="max-w-2xl">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.22em] text-primary">Prenotazione</p>
        <h2 className="text-balance font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Il tuo tavolo, in un minuto.</h2>
        <p className="mt-4 leading-7 text-white/60">Nessun account, nessuna attesa: scegli data, orario e numero di persone, e ricevi subito la conferma.</p>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-3">
        {[
          { n: "01", t: "Scegli quando", d: "Data, ora e numero di ospiti. Vedi solo gli orari davvero liberi." },
          { n: "02", t: "Lascia i tuoi dati", d: "Nome e telefono. Il ristorante ti avvisa al cellulare se serve." },
          { n: "03", t: "Ricevi la conferma", d: "Un codice a schermo — niente email obbligatorie, niente moduli lunghi." },
        ].map((step, i) => <Reveal key={step.n} delay={i * 90} className="surface-3d-dark rounded-2xl border border-white/10 bg-card p-6">
          <span className="font-mono text-sm font-semibold text-primary">{step.n}</span>
          <p className="mt-3 text-lg font-semibold">{step.t}</p>
          <p className="mt-2 text-sm leading-6 text-white/55">{step.d}</p>
        </Reveal>)}
      </div>
      <div className="mt-10">
        <Link href="/prenotazione" className="inline-flex min-h-13 items-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Prenota ora<ArrowRight className="size-4" />
        </Link>
      </div>
    </section>

    {/* ── Info rapide ──────────────────────────────────────────────────── */}
    <section className="mx-auto max-w-6xl px-5 pb-20">
      <div className="grid gap-6 rounded-3xl border border-white/10 bg-card p-8 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <h2 className="font-heading text-3xl font-semibold tracking-tight">Ti aspettiamo ad {city}.</h2>
          <p className="mt-3 flex items-start gap-2.5 text-white/65"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" />{restaurant.address}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {site.phoneHref && <a href={site.phoneHref} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white hover:border-primary/50"><Phone className="size-4 text-primary" />{site.phone}</a>}
            {site.whatsappHref && <a href={site.whatsappHref} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white hover:border-primary/50"><MessageCircle className="size-4 text-primary" />WhatsApp</a>}
            <Link href="/dove-siamo" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-medium text-white hover:border-primary/50"><Clock3 className="size-4 text-primary" />Orari e mappa</Link>
          </div>
        </div>
        <div className="rounded-2xl bg-primary/10 p-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Prenota online</p>
          <p className="mt-2 text-lg leading-6 text-white/80">Disponibilità in tempo reale, conferma immediata.</p>
          <Link href="/prenotazione" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-semibold text-primary-foreground">
            Prenota un tavolo<ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  </>;
}
