import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, ExternalLink, Phone, ShieldCheck, UsersRound } from "lucide-react";
import { brandConfig } from "@/config/brand";
import { hasLocale } from "@/lib/i18n";

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();

  const items = [
    { icon: ShieldCheck, title: "Conferma", text: "La prenotazione è confermata quando ricevi il codice riepilogativo. Conserva il link di gestione per modifiche o cancellazioni." },
    { icon: Clock3, title: "Orari e puntualità", text: "Gli orari effettivi dipendono dalla sede e dalla data selezionata. Nei fine settimana il servizio può essere organizzato su due turni." },
    { icon: UsersRound, title: "Richieste particolari", text: "Gruppi numerosi, sale private, allergie e accessibilità richiedono conferma del personale." },
    { icon: Phone, title: "Ritardi o variazioni", text: `Per ritardi, urgenze o richieste non gestibili online consulta i contatti della sede selezionata. ${brandConfig.phone}` },
  ];

  return <main className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
    <Link href={`/${locale}/book`} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Torna alla scelta del ristorante</Link>
    <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Prima di arrivare</p>
    <h1 className="mt-4 font-heading text-5xl">Condizioni di prenotazione</h1>
    <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">{items.map((item) => <section key={item.title} className="bg-card p-6"><item.icon className="size-5 text-primary" /><h2 className="mt-5 font-heading text-2xl">{item.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p></section>)}</div>
    <a href={brandConfig.bookingInfoUrl} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-primary">Consulta le informazioni di prenotazione<ExternalLink className="size-4" /></a>
  </main>;
}
