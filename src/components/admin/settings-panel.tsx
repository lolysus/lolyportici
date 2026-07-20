"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AudioWaveform,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  LoaderCircle,
  MapPin,
  MessageCircleMore,
  PauseCircle,
  PlayCircle,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { RestaurantLocation } from "@/config/brand";
import { cn } from "@/lib/utils";
import type { RestaurantSettings, ServiceMode, ServiceWindowSettings } from "@/types/settings";

const dayLabels = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

const modeChoices = [
  { value: "live", label: "Operativa", description: "Conferme automatiche sui canali attivi.", icon: PlayCircle, tone: "text-emerald-300" },
  { value: "approval", label: "Solo richieste", description: "Ogni richiesta passa dallo staff.", icon: AlertTriangle, tone: "text-amber-300" },
  { value: "paused", label: "In pausa", description: "Blocca nuove richieste web e voce.", icon: PauseCircle, tone: "text-rose-300" },
] as const;

const modeCopy: Record<ServiceMode, { label: string; note: string; className: string }> = {
  live: { label: "Operativa", note: "conferma automatica", className: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" },
  approval: { label: "Solo richieste", note: "verifica dello staff", className: "border-amber-400/20 bg-amber-400/8 text-amber-300" },
  paused: { label: "In pausa", note: "canali sospesi", className: "border-rose-400/20 bg-rose-400/8 text-rose-300" },
};

interface SettingsPanelProps {
  initialSettings: RestaurantSettings;
  location: RestaurantLocation;
}

export function SettingsPanel({ initialSettings, location }: SettingsPanelProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceAgentSync, setVoiceAgentSync] = useState<"configured" | "sandbox" | "pending" | null>(null);

  const activeWindows = settings.schedule.reduce((total, day) => total + Number(day.lunch.enabled) + Number(day.dinner.enabled), 0);
  const today = settings.schedule.find((day) => day.dayOfWeek === new Date().getDay());
  const todayServices = [
    today?.lunch.enabled ? `Pranzo ${today.lunch.startTime}–${today.lunch.endTime}` : null,
    today?.dinner.enabled ? `Cena ${today.dinner.startTime}–${today.dinner.endTime}` : null,
  ].filter(Boolean).join(" · ") || "Nessun servizio";
  const configurationChecks = [
    activeWindows > 0,
    settings.service.onlineBookingEnabled || settings.service.phoneBookingEnabled,
    settings.guestExperience.arrivalMessage.trim().length >= 10,
    settings.voiceAI.greeting.trim().length >= 10,
    settings.notifications.emailConfirmationEnabled || settings.notifications.smsConfirmationEnabled,
  ];
  const configurationHealth = Math.round((configurationChecks.filter(Boolean).length / configurationChecks.length) * 100);

  function updateSection<Section extends keyof RestaurantSettings>(section: Section, values: Partial<RestaurantSettings[Section]>) {
    setSettings((current) => ({ ...current, [section]: { ...current[section], ...values } }));
    markDirty();
  }

  function updateSchedule(dayOfWeek: number, period: "lunch" | "dinner", values: Partial<ServiceWindowSettings>) {
    setSettings((current) => ({
      ...current,
      schedule: current.schedule.map((day) => day.dayOfWeek === dayOfWeek
        ? { ...day, [period]: { ...day[period], ...values } }
        : day),
    }));
    markDirty();
  }

  function markDirty() {
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  async function save() {
    setPending(true);
    setSaved(false);
    setError(null);
    const response = await fetch("/api/admin/v1/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    const payload = await response.json() as {
      data?: RestaurantSettings;
      meta?: { voiceAgent?: { status?: "configured" | "sandbox" | "pending" } };
      error?: { message: string };
    };
    setPending(false);
    if (!response.ok || !payload.data) {
      setError(payload.error?.message ?? "Salvataggio non riuscito.");
      return;
    }
    setSettings(payload.data);
    setVoiceAgentSync(payload.meta?.voiceAgent?.status ?? null);
    setDirty(false);
    setSaved(true);
  }

  const currentMode = modeCopy[settings.operations.serviceMode];

  return <>
    <section className="surface-3d-dark relative mb-6 overflow-hidden rounded-3xl border border-white/8 bg-card" aria-labelledby="configuration-status-title">
      <div aria-hidden className="ambient-drift absolute -right-24 -top-32 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative grid gap-px bg-border/50 lg:grid-cols-[1.1fr_1fr_1fr]">
        <div className="bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Control profile</p>
              <h2 id="configuration-status-title" className="mt-2 font-heading text-2xl">{location.city}</h2>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" />{location.address}</p>
            </div>
            <Badge variant="outline" className={cn("mt-1", currentMode.className)}>{currentMode.label}</Badge>
          </div>
        </div>
        <StatusCard icon={CalendarClock} label="Servizi di oggi" value={todayServices} note={`${activeWindows} finestre settimanali attive`} />
        <div className="bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><ShieldCheck className="size-3.5 text-primary" />Completezza</p>
            <span className="font-mono text-sm font-semibold">{configurationHealth}%</span>
          </div>
          <Progress value={configurationHealth} className="mt-4 h-1.5" />
          <p className="mt-3 text-xs text-muted-foreground">Orari, canali, messaggi e regole della sede.</p>
        </div>
      </div>
    </section>

    <Tabs defaultValue="operations">
      <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto rounded-xl bg-card p-1">
        <TabsTrigger value="operations"><Gauge />Operatività</TabsTrigger>
        <TabsTrigger value="schedule"><Clock3 />Orari</TabsTrigger>
        <TabsTrigger value="booking"><SlidersHorizontal />Prenotazioni</TabsTrigger>
        <TabsTrigger value="guests"><Sparkles />Ospiti</TabsTrigger>
        <TabsTrigger value="notifications"><BellRing />Avvisi</TabsTrigger>
        <TabsTrigger value="voice"><AudioWaveform />AI voce</TabsTrigger>
      </TabsList>

      <TabsContent value="operations">
        <SettingsCard title="Stato operativo" description="Il profilo attivo governa contemporaneamente booking web, API, voce AI e motore di disponibilità.">
          <div role="radiogroup" aria-label="Stato operativo della sede" className="grid gap-3 sm:col-span-2 lg:grid-cols-3">
            {modeChoices.map((mode) => <button
              key={mode.value}
              type="button"
              role="radio"
              aria-checked={settings.operations.serviceMode === mode.value}
              onClick={() => updateSection("operations", { serviceMode: mode.value })}
              className={cn(
                "rounded-2xl border p-4 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settings.operations.serviceMode === mode.value ? "border-primary/45 bg-primary/8" : "border-white/8 bg-background/25 hover:border-white/15",
              )}
            >
              <span className="flex items-center justify-between gap-3"><mode.icon className={cn("size-5", mode.tone)} />{settings.operations.serviceMode === mode.value && <CheckCircle2 className="size-4 text-primary" />}</span>
              <span className="mt-5 block text-sm font-semibold">{mode.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{mode.description}</span>
            </button>)}
          </div>

          <div className="rounded-2xl border border-white/8 bg-background/25 p-4 sm:col-span-2">
            <p className="text-sm font-semibold">Ritmo e soglie operative</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Le soglie accendono gli avvisi nella dashboard senza bloccare automaticamente il servizio.</p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Field id="capacity-warning" label="Allerta saturazione" type="number" min={50} max={100} value={String(settings.operations.capacityWarningPercent)} setValue={(value) => updateSection("operations", { capacityWarningPercent: Number(value) })} suffix="%" />
              <Field id="waitlist-alert" label="Allerta lista d’attesa" type="number" min={1} max={100} value={String(settings.operations.waitlistAlertCount)} setValue={(value) => updateSection("operations", { waitlistAlertCount: Number(value) })} suffix="ospiti" />
              <Field id="large-party-alert" label="Gruppo importante da" type="number" min={2} max={100} value={String(settings.operations.largePartyAlertSize)} setValue={(value) => updateSection("operations", { largePartyAlertSize: Number(value) })} suffix="coperti" />
              <Field id="max-covers" label="Capienza simultanea" type="number" min={1} max={500} value={String(settings.service.maximumCovers)} setValue={(value) => updateSection("service", { maximumCovers: Number(value) })} suffix="coperti" />
            </div>
          </div>

          <Field id="slot-interval" label="Frequenza degli arrivi" type="number" min={5} max={180} value={String(settings.service.slotIntervalMinutes)} setValue={(value) => updateSection("service", { slotIntervalMinutes: Number(value) })} suffix="min" />
          <Field id="turnaround" label="Buffer di riassetto" type="number" min={0} max={120} value={String(settings.service.turnaroundMinutes)} setValue={(value) => updateSection("service", { turnaroundMinutes: Number(value) })} suffix="min" />
          <Field id="max-arrivals" label="Arrivi massimi per frequenza" type="number" min={1} max={100} value={String(settings.service.maximumArrivalsPerSlot)} setValue={(value) => updateSection("service", { maximumArrivalsPerSlot: Number(value) })} />
          <div className="hidden sm:block" />
          <SwitchRow id="online-booking" label="Prenotazioni online" description="Mostra disponibilità e consente conferme dal sito quando la sede è operativa." checked={settings.service.onlineBookingEnabled} setChecked={(value) => updateSection("service", { onlineBookingEnabled: value })} />
          <SwitchRow id="phone-booking" label="Prenotazioni AI telefonica" description="Abilita disponibilità, hold e conferme attraverso l’assistente vocale." checked={settings.service.phoneBookingEnabled} setChecked={(value) => updateSection("service", { phoneBookingEnabled: value })} />
        </SettingsCard>
      </TabsContent>

      <TabsContent value="schedule">
        <Card className="surface-3d-dark overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="font-heading text-2xl">Settimana di servizio</CardTitle>
            <CardDescription>Attiva pranzo e cena giorno per giorno. Le modifiche alimentano subito calendario pubblico e disponibilità.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {settings.schedule.map((day) => <ScheduleDayRow key={day.dayOfWeek} dayOfWeek={day.dayOfWeek} lunch={day.lunch} dinner={day.dinner} update={updateSchedule} />)}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="booking">
        <div className="grid gap-6 xl:grid-cols-2">
          <SettingsCard title="Regole di prenotazione" description="Limiti applicati prima di proporre gli orari disponibili.">
            <Field id="min-party" label="Minimo ospiti" type="number" min={1} max={20} value={String(settings.rules.minimumPartySize)} setValue={(value) => updateSection("rules", { minimumPartySize: Number(value) })} />
            <Field id="max-party" label="Massimo per conferma online" type="number" min={1} max={100} value={String(settings.rules.maximumPartySize)} setValue={(value) => updateSection("rules", { maximumPartySize: Number(value) })} />
            <SwitchRow id="manual-approval" label="Verifica manuale permanente" description="Mantiene ogni richiesta in approvazione anche quando la sede è operativa." checked={settings.rules.requiresManualApproval} setChecked={(value) => updateSection("rules", { requiresManualApproval: value })} />
            <SwitchRow id="requires-deposit" label="Caparra da verificare" description="Richiede il controllo dello staff prima della conferma." checked={settings.rules.requiresDeposit} setChecked={(value) => updateSection("rules", { requiresDeposit: value })} />
            {settings.rules.requiresDeposit && <Field id="deposit-amount" label="Importo caparra" type="number" min={0} max={10000} value={String(settings.rules.depositAmount)} setValue={(value) => updateSection("rules", { depositAmount: Number(value) })} suffix="€" />}
          </SettingsCard>

          <SettingsCard title="Durata dell’esperienza" description="Tempi usati dal motore per gestire gli intervalli di prenotazione.">
            <Field id="duration-1-2" label="1–2 persone" type="number" min={45} max={360} value={String(settings.durations.party1To2)} setValue={(value) => updateSection("durations", { party1To2: Number(value) })} suffix="min" />
            <Field id="duration-3-4" label="3–4 persone" type="number" min={45} max={360} value={String(settings.durations.party3To4)} setValue={(value) => updateSection("durations", { party3To4: Number(value) })} suffix="min" />
            <Field id="duration-5-6" label="5–6 persone" type="number" min={45} max={360} value={String(settings.durations.party5To6)} setValue={(value) => updateSection("durations", { party5To6: Number(value) })} suffix="min" />
            <Field id="duration-7-10" label="7–10 persone" type="number" min={45} max={360} value={String(settings.durations.party7To10)} setValue={(value) => updateSection("durations", { party7To10: Number(value) })} suffix="min" />
          </SettingsCard>

          <SettingsCard title="Tempi e policy" description="Finestre condivise da sito, staff e assistente telefonico." className="xl:col-span-2">
            <Field id="minimum-notice" label="Preavviso minimo" type="number" min={0} max={10080} value={String(settings.policies.minimumNoticeMinutes)} setValue={(value) => updateSection("policies", { minimumNoticeMinutes: Number(value) })} suffix="min" />
            <Field id="maximum-advance" label="Finestra prenotabile" type="number" min={1} max={730} value={String(settings.policies.maximumAdvanceDays)} setValue={(value) => updateSection("policies", { maximumAdvanceDays: Number(value) })} suffix="giorni" />
            <Field id="late-tolerance" label="Ritardo tollerato" type="number" min={0} max={120} value={String(settings.policies.lateToleranceMinutes)} setValue={(value) => updateSection("policies", { lateToleranceMinutes: Number(value) })} suffix="min" />
            <Field id="no-show-after" label="Segna no-show dopo" type="number" min={0} max={180} value={String(settings.policies.noShowAfterMinutes)} setValue={(value) => updateSection("policies", { noShowAfterMinutes: Number(value) })} suffix="min" />
            <Field id="cancel-deadline" label="Termine cancellazione" type="number" min={0} max={168} value={String(settings.policies.cancellationDeadlineHours)} setValue={(value) => updateSection("policies", { cancellationDeadlineHours: Number(value) })} suffix="ore" />
          </SettingsCard>
        </div>
      </TabsContent>

      <TabsContent value="guests">
        <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
          <SettingsCard title="Self-service ospite" description="Funzioni disponibili dal sito e dal link personale.">
            <SwitchRow id="feature-waitlist" label="Lista d’attesa" description="Consente di lasciare una richiesta quando non c’è disponibilità." checked={settings.features.waitlistEnabled} setChecked={(value) => updateSection("features", { waitlistEnabled: value })} />
            <SwitchRow id="feature-modify" label="Modifica prenotazione" description="L’ospite può aggiornare il numero di coperti dal proprio link." checked={settings.features.customerModificationEnabled} setChecked={(value) => updateSection("features", { customerModificationEnabled: value })} />
            <SwitchRow id="feature-cancel" label="Cancellazione self-service" description="L’ospite può annullare entro il termine configurato." checked={settings.features.customerCancellationEnabled} setChecked={(value) => updateSection("features", { customerCancellationEnabled: value })} />
            <SwitchRow id="feature-notifications" label="Comunicazioni automatiche" description="Attiva l’invio sui canali selezionati nella sezione Avvisi." checked={settings.features.automaticNotificationsEnabled} setChecked={(value) => updateSection("features", { automaticNotificationsEnabled: value })} />
          </SettingsCard>

          <SettingsCard title="Informazioni prima dell’arrivo" description="Questi testi vengono mostrati nel booking e passati all’assistente telefonico.">
            <TextareaField id="arrival-message" label="Messaggio di accoglienza" value={settings.guestExperience.arrivalMessage} setValue={(value) => updateSection("guestExperience", { arrivalMessage: value })} />
            <TextareaField id="directions" label="Come arrivare" value={settings.guestExperience.directions} setValue={(value) => updateSection("guestExperience", { directions: value })} />
            <TextareaField id="parking-info" label="Parcheggio" value={settings.guestExperience.parkingInfo} setValue={(value) => updateSection("guestExperience", { parkingInfo: value })} />
            <TextareaField id="accessibility-info" label="Accessibilità" value={settings.guestExperience.accessibilityInfo} setValue={(value) => updateSection("guestExperience", { accessibilityInfo: value })} />
            <div className="sm:col-span-2"><TextareaField id="dietary-notice" label="Allergie e necessità alimentari" value={settings.guestExperience.dietaryNotice} setValue={(value) => updateSection("guestExperience", { dietaryNotice: value })} /></div>
          </SettingsCard>
        </div>
      </TabsContent>

      <TabsContent value="notifications">
        <SettingsCard title="Conferme e attenzioni operative" description="Configura ciò che riceve l’ospite e quali segnali entrano nella regia operativa.">
          <SwitchRow id="email-confirmation" label="Conferma via email" description="Invia il riepilogo quando l’ospite lascia un indirizzo email." checked={settings.notifications.emailConfirmationEnabled} setChecked={(value) => updateSection("notifications", { emailConfirmationEnabled: value })} />
          <SwitchRow id="sms-confirmation" label="Conferma via SMS" description="Invia il codice prenotazione al numero di telefono indicato." checked={settings.notifications.smsConfirmationEnabled} setChecked={(value) => updateSection("notifications", { smsConfirmationEnabled: value })} />
          <SwitchRow id="staff-allergy-alerts" label="Avvisi allergie" description="Evidenzia nella dashboard le prenotazioni con allergie o intolleranze." checked={settings.notifications.staffAllergyAlertsEnabled} setChecked={(value) => updateSection("notifications", { staffAllergyAlertsEnabled: value })} />
          <SwitchRow id="staff-large-party-alerts" label="Avvisi gruppi importanti" description={`Evidenzia le prenotazioni da ${settings.operations.largePartyAlertSize} coperti in su.`} checked={settings.notifications.staffLargePartyAlertsEnabled} setChecked={(value) => updateSection("notifications", { staffLargePartyAlertsEnabled: value })} />
          <SwitchRow id="staff-waitlist-alerts" label="Avvisi lista d’attesa" description={`Segnala quando si raggiungono ${settings.operations.waitlistAlertCount} richieste in attesa.`} checked={settings.notifications.staffWaitlistAlertsEnabled} setChecked={(value) => updateSection("notifications", { staffWaitlistAlertsEnabled: value })} />
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground sm:col-span-2"><p className="flex items-center gap-2 font-semibold text-foreground"><MessageCircleMore className="size-4 text-primary" />Gerarchia delle comunicazioni</p><p className="mt-1">L’interruttore generale nelle funzioni ospite può sospendere tutti gli invii senza perdere la configurazione dei singoli canali.</p></div>
        </SettingsCard>
      </TabsContent>

      <TabsContent value="voice">
        <SettingsCard title="Comportamento AI telefonica" description="Policy operative applicate per la sede selezionata agli strumenti Retell e Telnyx.">
          <Field id="voice-name" label="Nome assistente" type="text" value={settings.voiceAI.assistantName} setValue={(value) => updateSection("voiceAI", { assistantName: value })} />
          <div><Label htmlFor="voice-language">Lingua predefinita</Label><Select value={settings.voiceAI.defaultLanguage} onValueChange={(value) => updateSection("voiceAI", { defaultLanguage: value as RestaurantSettings["voiceAI"]["defaultLanguage"] })}><SelectTrigger id="voice-language" className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="it">Italiano</SelectItem><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select></div>
          <div className="sm:col-span-2"><Label htmlFor="voice-greeting">Messaggio iniziale</Label><Textarea id="voice-greeting" value={settings.voiceAI.greeting} onChange={(event) => updateSection("voiceAI", { greeting: event.target.value })} className="mt-2 min-h-24" /></div>
          <SwitchRow id="voice-new" label="Crea nuove prenotazioni" description="Permette all’AI di creare e confermare una prenotazione." checked={settings.voiceAI.allowNewReservations} setChecked={(value) => updateSection("voiceAI", { allowNewReservations: value })} />
          <SwitchRow id="voice-modify" label="Modifica prenotazioni" description="Permette all’AI di aggiornare richieste esistenti." checked={settings.voiceAI.allowModifyReservations} setChecked={(value) => updateSection("voiceAI", { allowModifyReservations: value })} />
          <SwitchRow id="voice-cancel" label="Cancella prenotazioni" description="Permette all’AI di annullare dopo l’identificazione dell’ospite." checked={settings.voiceAI.allowCancellation} setChecked={(value) => updateSection("voiceAI", { allowCancellation: value })} />
          <SwitchRow id="voice-waitlist" label="Gestisce lista d’attesa" description="Permette all’AI di registrare richieste senza disponibilità." checked={settings.voiceAI.allowWaitlist} setChecked={(value) => updateSection("voiceAI", { allowWaitlist: value })} />
          <SwitchRow id="voice-allergies" label="Trasferisci in caso di allergie" description="L’AI raccoglie il dato, rilascia l’hold e richiede conferma umana." checked={settings.voiceAI.transferOnAllergies} setChecked={(value) => updateSection("voiceAI", { transferOnAllergies: value })} />
          <Field id="voice-large-party" label="Trasferisci gruppi da" type="number" min={2} max={100} value={String(settings.voiceAI.transferPartySize)} setValue={(value) => updateSection("voiceAI", { transferPartySize: Number(value) })} suffix="ospiti" />
          {voiceAgentSync && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground sm:col-span-2"><span className="font-semibold text-foreground">Sincronizzazione agente:</span>{" "}{voiceAgentSync === "configured" ? "configurazione esterna aggiornata." : voiceAgentSync === "sandbox" ? "policy attive nelle API; collega Retell per aggiornare l’agente esterno." : "policy salvate; la sincronizzazione esterna verrà ritentata."}</div>}
        </SettingsCard>
      </TabsContent>
    </Tabs>

    <div className="sticky bottom-4 z-20 mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-background/90 p-3 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 px-2">
        <p className="text-sm font-medium">{dirty ? "Modifiche non ancora applicate" : saved ? "Configurazione aggiornata" : `Profilo ${currentMode.note}`}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">Le modifiche riguardano soltanto {location.shortName}.</p>
      </div>
      <Button onClick={save} disabled={pending || !dirty} className="min-w-48">
        {pending ? <LoaderCircle className="animate-spin" /> : saved ? <CheckCircle2 /> : <Save />}
        {pending ? "Applicazione…" : saved ? "Configurazione applicata" : "Salva e applica"}
      </Button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
  </>;
}

interface ScheduleDayRowProps {
  dayOfWeek: number;
  lunch: ServiceWindowSettings;
  dinner: ServiceWindowSettings;
  update: (dayOfWeek: number, period: "lunch" | "dinner", values: Partial<ServiceWindowSettings>) => void;
}

function ScheduleDayRow({ dayOfWeek, lunch, dinner, update }: ScheduleDayRowProps) {
  return <div className="grid gap-4 px-5 py-5 lg:grid-cols-[140px_1fr_1fr] lg:items-center lg:px-6">
    <div className="flex items-center justify-between lg:block"><p className="text-sm font-semibold">{dayLabels[dayOfWeek]}</p><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground lg:mt-1 lg:block">Giorno {String(dayOfWeek || 7).padStart(2, "0")}</span></div>
    <ServiceWindow label="Pranzo" dayOfWeek={dayOfWeek} period="lunch" window={lunch} update={update} />
    <ServiceWindow label="Cena" dayOfWeek={dayOfWeek} period="dinner" window={dinner} update={update} />
  </div>;
}

function ServiceWindow({ label, dayOfWeek, period, window, update }: { label: string; dayOfWeek: number; period: "lunch" | "dinner"; window: ServiceWindowSettings; update: ScheduleDayRowProps["update"] }) {
  const id = `${period}-${dayOfWeek}`;
  return <div className={cn("rounded-xl border p-3 transition-colors", window.enabled ? "border-primary/20 bg-primary/[0.045]" : "border-white/8 bg-background/20")}>
    <div className="flex items-center justify-between gap-3"><Label htmlFor={id} className="text-xs">{label}</Label><Switch id={id} checked={window.enabled} onCheckedChange={(enabled) => update(dayOfWeek, period, { enabled })} /></div>
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <Input aria-label={`Inizio ${label.toLocaleLowerCase("it")} ${dayLabels[dayOfWeek]}`} type="time" value={window.startTime} disabled={!window.enabled} onChange={(event) => update(dayOfWeek, period, { startTime: event.target.value })} className="h-9" />
      <span className="text-xs text-muted-foreground">–</span>
      <Input aria-label={`Fine ${label.toLocaleLowerCase("it")} ${dayLabels[dayOfWeek]}`} type="time" value={window.endTime} disabled={!window.enabled} onChange={(event) => update(dayOfWeek, period, { endTime: event.target.value })} className="h-9" />
    </div>
  </div>;
}

function SettingsCard({ title, description, children, className }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return <Card className={cn("surface-3d-dark", className)}><CardHeader><CardTitle className="font-heading text-2xl">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="grid gap-6 sm:grid-cols-2">{children}</CardContent></Card>;
}

function StatusCard({ icon: Icon, label, value, note }: { icon: typeof CalendarClock; label: string; value: string; note: string }) {
  return <div className="bg-card p-5 sm:p-6"><p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><Icon className="size-3.5 text-primary" />{label}</p><p className="mt-3 text-sm font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function Field({ id, label, type, value, setValue, suffix, min, max }: { id: string; label: string; type: string; value: string; setValue: (value: string) => void; suffix?: string; min?: number; max?: number }) {
  return <div><Label htmlFor={id}>{label}</Label><div className="mt-2 flex items-center gap-2"><Input id={id} type={type} min={min} max={max} value={value} onChange={(event) => setValue(event.target.value)} />{suffix && <span className="min-w-fit text-xs text-muted-foreground">{suffix}</span>}</div></div>;
}

function TextareaField({ id, label, value, setValue }: { id: string; label: string; value: string; setValue: (value: string) => void }) {
  return <div><Label htmlFor={id}>{label}</Label><Textarea id={id} value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 min-h-24 resize-y" /></div>;
}

function SwitchRow({ id, label, description, checked, setChecked }: { id: string; label: string; description: string; checked: boolean; setChecked: (value: boolean) => void }) {
  return <div className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-background/20 p-4"><div><Label htmlFor={id}>{label}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div><Switch id={id} checked={checked} onCheckedChange={setChecked} /></div>;
}
