import Link from "next/link";
import { BellRing, CalendarCheck2, CheckCircle2, CircleHelp, ExternalLink, MapPin, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/admin/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getActiveAdminLocation } from "@/lib/admin/location";
import { requirePermission } from "@/lib/auth/dal";

const workflow = [
  { icon: BellRing, title: "1. Ricevi", text: "La nuova prenotazione appare nel centro notifiche e, se attivo, viene accompagnata dal segnale sonoro." },
  { icon: CalendarCheck2, title: "2. Verifica", text: "Apri l’agenda, controlla i dati dell’ospite, le allergie, le note e l’orario richiesto." },
  { icon: UsersRound, title: "3. Segui", text: "Fai avanzare lo stato da confermata ad arrivata, in servizio e infine completata." },
];

export default async function HelpPage() {
  const session = await requirePermission("reservations:read");
  const location = await getActiveAdminLocation(session);
  return <>
    <PageHeading eyebrow="Formazione inclusa" title="Guida operativa" description={`Le procedure essenziali per usare la regia di ${location.city} durante il servizio.`} actions={<Badge variant="outline"><CircleHelp /> Sempre disponibile</Badge>} />
    <section className="surface-3d-dark overflow-hidden rounded-2xl border bg-card"><div className="border-b p-5 sm:p-6"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Flusso quotidiano</p><h2 className="mt-2 font-heading text-2xl">Dalla richiesta al servizio</h2></div><div className="grid gap-px bg-border md:grid-cols-3">{workflow.map((item) => <article key={item.title} className="bg-card p-5 sm:p-6"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><item.icon className="size-4" /></span><h3 className="mt-5 font-semibold">{item.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p></article>)}</div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="font-heading text-2xl">Checklist di apertura</h2><ul className="mt-5 space-y-3">{["Verifica che l’indicatore in alto sia Live o che il controllo periodico sia attivo.", "Apri il centro notifiche e abilita il suono sul dispositivo dedicato.", "Controlla agenda, coperti previsti, allergie e gruppi numerosi.", "Conferma che la sede selezionata in alto sia quella corretta.", "Se necessario, sospendi il booking da Impostazioni senza perdere prenotazioni o configurazione."].map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-400" /><span>{item}</span></li>)}</ul></section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6"><h2 className="font-heading text-2xl">Azioni rapide</h2><div className="mt-5 grid gap-3"><Button asChild className="justify-between"><Link href="/admin/reservations"><span className="flex items-center gap-2"><CalendarCheck2 />Apri agenda</span><ExternalLink /></Link></Button>{session.permissions.includes("settings:write") && <Button asChild variant="outline" className="justify-between"><Link href="/admin/settings"><span className="flex items-center gap-2"><Settings2 />Regole di sede</span><ExternalLink /></Link></Button>}<Button asChild variant="outline" className="justify-between"><Link href="/admin/locations"><span className="flex items-center gap-2"><MapPin />Cambia sede</span><ExternalLink /></Link></Button></div><p className="mt-5 flex gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />Ogni modifica operativa è limitata alla sede autorizzata per il tuo account.</p></section>
    </div>
  </>;
}
