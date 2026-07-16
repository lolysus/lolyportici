"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, RadioTower, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RestaurantLocation } from "@/config/brand";
import { restaurantThemeStyle } from "@/lib/brand-theme";
import type { RestaurantSettings, ServiceMode } from "@/types/settings";

type ManagedSettings = { location: RestaurantLocation; settings: RestaurantSettings };

const modeChoices: Array<{ value: ServiceMode; title: string; description: string }> = [
  { value: "live", title: "Operativa", description: "Conferme automatiche sui canali attivi." },
  { value: "approval", title: "Solo richieste", description: "Il personale approva ogni nuova richiesta." },
  { value: "paused", title: "In pausa", description: "Il booking online viene sospeso su entrambe le insegne." },
];

function sharedValue<T>(restaurants: ManagedSettings[], read: (settings: RestaurantSettings) => T) {
  const first = read(restaurants[0].settings);
  return restaurants.every((restaurant) => Object.is(read(restaurant.settings), first)) ? first : undefined;
}

export function MasterRulesPanel({ restaurants }: { restaurants: ManagedSettings[] }) {
  const initialMode = sharedValue(restaurants, (settings) => settings.operations.serviceMode) ?? "live";
  const [serviceMode, setServiceMode] = useState<ServiceMode>(initialMode);
  const [waitlistEnabled, setWaitlistEnabled] = useState(sharedValue(restaurants, (settings) => settings.features.waitlistEnabled) ?? true);
  const [customerCancellationEnabled, setCustomerCancellationEnabled] = useState(sharedValue(restaurants, (settings) => settings.features.customerCancellationEnabled) ?? true);
  const [advanceDays, setAdvanceDays] = useState(sharedValue(restaurants, (settings) => settings.policies.maximumAdvanceDays) ?? 90);
  const [minimumNotice, setMinimumNotice] = useState(sharedValue(restaurants, (settings) => settings.policies.minimumNoticeMinutes) ?? 60);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const divergence = useMemo(() => ({
    mode: sharedValue(restaurants, (settings) => settings.operations.serviceMode) === undefined,
    waitlist: sharedValue(restaurants, (settings) => settings.features.waitlistEnabled) === undefined,
    cancellation: sharedValue(restaurants, (settings) => settings.features.customerCancellationEnabled) === undefined,
    advance: sharedValue(restaurants, (settings) => settings.policies.maximumAdvanceDays) === undefined,
  }), [restaurants]);

  function applyRules() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        for (const restaurant of restaurants) {
          const select = await fetch("/api/admin/v1/location", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug: restaurant.location.slug }),
          });
          if (!select.ok) throw new Error("Non è stato possibile selezionare il ristorante.");

          const nextSettings: RestaurantSettings = {
            ...restaurant.settings,
            operations: { ...restaurant.settings.operations, serviceMode },
            policies: {
              ...restaurant.settings.policies,
              maximumAdvanceDays: Math.max(1, Math.min(730, advanceDays)),
              minimumNoticeMinutes: Math.max(0, Math.min(10_080, minimumNotice)),
            },
            features: {
              ...restaurant.settings.features,
              waitlistEnabled,
              customerCancellationEnabled,
            },
          };
          const update = await fetch("/api/admin/v1/settings", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(nextSettings),
          });
          if (!update.ok) throw new Error("Le regole non sono state applicate a entrambi i ristoranti.");
        }
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Aggiornamento non riuscito.");
      }
    });
  }

  return <div className="space-y-6">
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Stato dei ristoranti">
      {restaurants.map(({ location, settings }) => <article key={location.id} style={restaurantThemeStyle(location)} className="surface-3d-dark overflow-hidden rounded-2xl border border-white/8 border-t-2 border-t-primary bg-card">
        <div className="flex items-start justify-between gap-4 p-5"><BrandLogo restaurant={location} priority compact className="max-w-52" /><Badge variant="outline" className={settings.operations.serviceMode === "live" ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" : "border-amber-400/20 bg-amber-400/8 text-amber-300"}><RadioTower />{settings.operations.serviceMode === "live" ? "Operativa" : "Su richiesta"}</Badge></div>
        <div className="grid grid-cols-3 border-t border-white/8 bg-background/20 text-center text-xs"><Stat label="Capienza" value={`${settings.service.maximumCovers}`} /><Stat label="Anticipo" value={`${settings.policies.maximumAdvanceDays} gg`} /><Stat label="Preavviso" value={`${settings.policies.minimumNoticeMinutes} min`} /></div>
      </article>)}
    </section>

    <Card className="surface-3d-dark overflow-hidden">
      <CardHeader className="border-b"><div className="flex items-start gap-4"><span className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><SlidersHorizontal className="size-5" /></span><div><CardTitle className="font-heading text-2xl">Policy master</CardTitle><CardDescription className="mt-1">Un unico salvataggio, due configurazioni aggiornate. Le differenze attuali vengono evidenziate prima dell&apos;applicazione.</CardDescription></div></div></CardHeader>
      <CardContent className="grid gap-6 p-5 lg:grid-cols-2 lg:p-7">
        <div><Label htmlFor="master-service-mode">Stato booking su entrambi i ristoranti</Label><Select value={serviceMode} onValueChange={(value) => setServiceMode(value as ServiceMode)}><SelectTrigger id="master-service-mode" className="mt-2"><SelectValue /></SelectTrigger><SelectContent>{modeChoices.map((mode) => <SelectItem key={mode.value} value={mode.value}>{mode.title} · {mode.description}</SelectItem>)}</SelectContent></Select>{divergence.mode && <p className="mt-2 text-xs text-amber-300">I due ristoranti hanno stati diversi: questo salvataggio li allineerà.</p>}</div>
        <div><Label htmlFor="master-advance">Finestra massima di prenotazione</Label><div className="mt-2 flex items-center gap-3"><Input id="master-advance" type="number" min={1} max={730} value={advanceDays} onChange={(event) => setAdvanceDays(Number(event.target.value))} /><span className="text-sm text-muted-foreground">giorni</span></div>{divergence.advance && <p className="mt-2 text-xs text-amber-300">Valori differenti rilevati tra YUKO e KouSushi.</p>}</div>
        <div><Label htmlFor="master-notice">Preavviso minimo</Label><div className="mt-2 flex items-center gap-3"><Input id="master-notice" type="number" min={0} max={10080} value={minimumNotice} onChange={(event) => setMinimumNotice(Number(event.target.value))} /><span className="text-sm text-muted-foreground">minuti</span></div></div>
        <div className="space-y-3"><MasterSwitch id="master-waitlist" label="Lista d'attesa attiva" description="Raccoglie richieste senza disponibilità immediata." checked={waitlistEnabled} onCheckedChange={setWaitlistEnabled} divergent={divergence.waitlist} /><MasterSwitch id="master-cancellation" label="Cancellazione cliente attiva" description="Consente la cancellazione entro la policy di ciascun ristorante." checked={customerCancellationEnabled} onCheckedChange={setCustomerCancellationEnabled} divergent={divergence.cancellation} /></div>
      </CardContent>
    </Card>

    <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-2xl border border-white/10 bg-background/90 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"><p className="flex items-center gap-2 px-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary" />L&apos;operatore di sede non può modificare queste policy comuni.</p><Button onClick={applyRules} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : saved ? <CheckCircle2 /> : <Save />}{pending ? "Applicazione su due ristoranti…" : saved ? "Regole allineate" : "Applica a entrambi"}</Button></div>
    {error && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="border-r border-white/8 px-3 py-4 last:border-r-0"><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function MasterSwitch({ id, label, description, checked, onCheckedChange, divergent }: { id: string; label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void; divergent: boolean }) {
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-background/20 p-4"><div><Label htmlFor={id}>{label}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>{divergent && <p className="mt-1 text-xs text-amber-300">Impostazioni diverse rilevate.</p>}</div><Switch id={id} checked={checked} onCheckedChange={onCheckedChange} /></div>;
}
