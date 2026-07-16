import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { brandConfig } from "@/config/brand";
import { hasLocale } from "@/lib/i18n";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  return <main className="mx-auto max-w-2xl px-5 py-16 sm:py-24">
    <Link href={`/${locale}/book`} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Torna alla scelta del ristorante</Link>
    <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Trasparenza sui dati</p>
    <h1 className="mt-4 font-heading text-5xl">Privacy</h1>
    <div className="mt-8 space-y-6 leading-7 text-muted-foreground">
      <p>Per gestire la prenotazione raccogliamo i dati inseriti nel modulo: nome, recapiti, dettagli del tavolo e, solo se comunicati, allergie o esigenze di accessibilità. Il consenso marketing resta separato e facoltativo.</p>
      <p>Il titolare del trattamento è <strong className="font-medium text-foreground">{brandConfig.legalName}</strong>, con sede in {brandConfig.address}. L’informativa ufficiale completa è pubblicata sul sito del ristorante.</p>
    </div>
    <div className="mt-10 flex flex-wrap gap-3">
      <a href={brandConfig.privacyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">Leggi l’informativa ufficiale<ExternalLink className="size-4" /></a>
      {brandConfig.phoneHref ? <a href={brandConfig.phoneHref} className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium"><Phone className="size-4" />{brandConfig.phone}</a> : <span className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm text-muted-foreground"><Phone className="size-4" />{brandConfig.phone}</span>}
    </div>
  </main>;
}
