"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Accessibility, ArrowLeft, ArrowRight, CalendarDays, CalendarPlus, Camera, Check, CheckCircle2, Clock3, Download, Info, LoaderCircle, LockKeyhole, Navigation, PhoneCall, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import type { RestaurantLocation } from "@/config/brand";
import { BookingDatePicker } from "@/components/public-booking/booking-date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/lib/i18n";
import type { PublicAvailabilityOption, PublicAvailabilityResult } from "@/types/api";
import { cn } from "@/lib/utils";
import { formatTimeInZone } from "@/lib/datetime";
import { firstBookableServiceDate, type BookingCalendarRules } from "@/lib/service-calendar";
import { privacyPolicyVersion } from "@/config/privacy-policy";
import { deliverReceipt, drawReceipt, receiptFileName } from "@/lib/booking-receipt";

type Fields = { firstName: string; lastName: string; phone: string; email: string; notes: string; allergies: string; accessibilityNeeds: string; privacyConsent: boolean; marketingConsent: boolean };
type Completion = { type: "reservation"; code: string; token: string } | { type: "waitlist"; id: string };

const detailCopy = {
  it: { notes: "Occasione o richieste per il servizio", allergies: "Allergie o intolleranze", accessibility: "Esigenze di accessibilità", optional: "facoltativo" },
  en: { notes: "Occasion or service requests", allergies: "Allergies or intolerances", accessibility: "Accessibility needs", optional: "optional" },
  es: { notes: "Ocasión o solicitudes de servicio", allergies: "Alergias o intolerancias", accessibility: "Necesidades de accesibilidad", optional: "opcional" },
} as const;

const flowCopy = {
  it: {
    exactPartySize: "Numero esatto di ospiti",
    largeParty: (maximum: number) => `Oltre ${maximum} ospiti invii una richiesta al personale, senza bloccare disponibilità.`,
    deposit: (amount: string) => `Questa richiesta viene verificata dallo staff prima della conferma; la caparra indicativa è di ${amount}.`,
    staffReview: "Questa richiesta viene inviata al personale per la verifica prima della conferma.",
    realtimeCheck: "Al passaggio successivo verifichiamo capienza, arrivi e durata in tempo reale.",
    noBookableDateTitle: "Nessuna data prenotabile online",
    noBookableDateDescription: "Nella finestra di prenotazione configurata non ci sono servizi disponibili online. Contatta il ristorante per una richiesta assistita.",
    callRestaurant: "Chiama il ristorante",
    instantConfirmation: "conferma immediata",
    staffReviewTitle: "Richiesta da verificare dal personale",
    staffReviewDescription: "Indica l’orario preferito: il personale verifica la disponibilità, l’eventuale caparra e ti ricontatta.",
    waitlistDescription: "Lascia l’orario preferito: ti avviseremo appena si libera disponibilità.",
    waitlistDisabled: "La lista d’attesa non è attiva: contatta il ristorante per una verifica manuale.",
    preferredTime: "Orario preferito",
    sendStaffRequest: "Invia richiesta allo staff",
    dateNotSelected: "Da scegliere",
    partySizeRequired: "Seleziona il numero di persone: è obbligatorio per mostrarti solo gli orari disponibili.",
    privacyRead: "Leggi l’informativa",
    privacyVersion: (version: string) => `versione ${version}`,
    receiptTitle: "Conferma prenotazione",
    receiptSave: "Salva la conferma",
    receiptWorking: "Preparo l’immagine…",
    receiptAlt: "Conferma della prenotazione da salvare",
    receiptHint: "Tieni premuta l’immagine per salvarla nella galleria, oppure usa il pulsante.",
    receiptFailed: "Non è stato possibile creare l’immagine. Fai uno screenshot di questa schermata: il codice è quello che conta.",
    newBooking: "Fai un’altra prenotazione",
    emailInvalid: "Controlla l’indirizzo email: così scritto non è valido. Puoi anche lasciarlo vuoto.",
    saveCodeTitle: "Salva questo codice adesso",
    saveCodeBody: "Non riceverai email di conferma. Fai uno screenshot di questa schermata o annota data, ora e codice: ti servono per presentarti e per modificare o annullare.",
    saveCodeEarly: "Non inviamo email di conferma: a fine prenotazione salva uno screenshot con data, ora e codice.",
    noEmailNotice: "Non riceverai un'email di conferma: al passaggio successivo salva il codice che ti mostriamo.",
  },
  en: {
    exactPartySize: "Exact number of guests",
    largeParty: (maximum: number) => `For groups over ${maximum} guests, send a request to the team without blocking availability.`,
    deposit: (amount: string) => `The team will review this request before confirmation; the indicative deposit is ${amount}.`,
    staffReview: "This request is sent to the team for review before confirmation.",
    realtimeCheck: "At the next step we check capacity, arrivals and duration in real time.",
    noBookableDateTitle: "No dates are available online",
    noBookableDateDescription: "There are no online services within the configured booking window. Contact the restaurant for assisted booking.",
    callRestaurant: "Call the restaurant",
    instantConfirmation: "instant confirmation",
    staffReviewTitle: "Request to be reviewed by the team",
    staffReviewDescription: "Choose your preferred time: the team will check availability, any deposit, and contact you without holding a table.",
    waitlistDescription: "Leave your preferred time and we will notify you as soon as availability opens up.",
    waitlistDisabled: "The waiting list is not active: contact the restaurant for a manual review.",
    preferredTime: "Preferred time",
    sendStaffRequest: "Send request to the team",
    dateNotSelected: "To be selected",
    partySizeRequired: "Choose the number of guests: this is required to show only available times.",
    privacyRead: "Read the privacy notice",
    privacyVersion: (version: string) => `version ${version}`,
    receiptTitle: "Booking confirmation",
    receiptSave: "Save the confirmation",
    receiptWorking: "Preparing the image…",
    receiptAlt: "Booking confirmation image to save",
    receiptHint: "Press and hold the image to save it to your gallery, or use the button.",
    receiptFailed: "The image could not be created. Take a screenshot of this screen: the code is what matters.",
    newBooking: "Make another booking",
    emailInvalid: "Check the email address: it is not valid as written. You can also leave it empty.",
    saveCodeTitle: "Save this code now",
    saveCodeBody: "You will not receive a confirmation email. Take a screenshot of this screen, or write down the date, time and code: you need them to turn up and to change or cancel.",
    saveCodeEarly: "We do not send confirmation emails: at the end, save a screenshot with the date, time and code.",
    noEmailNotice: "You will not receive a confirmation email: on the next step, save the code we show you.",
  },
  es: {
    exactPartySize: "Número exacto de comensales",
    largeParty: (maximum: number) => `Para grupos de más de ${maximum} comensales, envía una solicitud al equipo sin bloquear disponibilidad.`,
    deposit: (amount: string) => `El equipo revisará esta solicitud antes de confirmarla; el depósito orientativo es ${amount}.`,
    staffReview: "Esta solicitud se envía al equipo para su revisión antes de confirmarla.",
    realtimeCheck: "En el siguiente paso comprobamos capacidad, llegadas y duración en tiempo real.",
    noBookableDateTitle: "No hay fechas disponibles online",
    noBookableDateDescription: "No hay servicios online en la ventana de reserva configurada. Contacta con el restaurante para una solicitud asistida.",
    callRestaurant: "Llamar al restaurante",
    instantConfirmation: "confirmación inmediata",
    staffReviewTitle: "Solicitud pendiente de revisión del equipo",
    staffReviewDescription: "Indica la hora preferida: el equipo comprobará disponibilidad, posible depósito y te contactará sin bloquear una mesa.",
    waitlistDescription: "Deja tu hora preferida y te avisaremos en cuanto haya disponibilidad.",
    waitlistDisabled: "La lista de espera no está activa: contacta con el restaurante para una revisión manual.",
    preferredTime: "Hora preferida",
    sendStaffRequest: "Enviar solicitud al equipo",
    dateNotSelected: "Por elegir",
    partySizeRequired: "Selecciona el numero de personas: es obligatorio para mostrar solo los horarios disponibles.",
    privacyRead: "Leer la información de privacidad",
    privacyVersion: (version: string) => `versión ${version}`,
    receiptTitle: "Confirmación de reserva",
    receiptSave: "Guardar la confirmación",
    receiptWorking: "Preparando la imagen…",
    receiptAlt: "Imagen de confirmación de la reserva para guardar",
    receiptHint: "Mantén pulsada la imagen para guardarla en la galería, o usa el botón.",
    receiptFailed: "No se ha podido crear la imagen. Haz una captura de esta pantalla: el código es lo que importa.",
    newBooking: "Hacer otra reserva",
    emailInvalid: "Revisa el email: no es válido tal como está escrito. También puedes dejarlo vacío.",
    saveCodeTitle: "Guarda este código ahora",
    saveCodeBody: "No recibirás un email de confirmación. Haz una captura de esta pantalla o anota fecha, hora y código: los necesitas para presentarte y para cambiar o anular.",
    saveCodeEarly: "No enviamos emails de confirmación: al final, guarda una captura con la fecha, la hora y el código.",
    noEmailNotice: "No recibirás un email de confirmación: en el siguiente paso, guarda el código que te mostramos.",
  },
} as const;

export type BookingFeatures = {
  onlineBookingEnabled: boolean;
  waitlistEnabled: boolean;
  minimumPartySize: number;
  maximumPartySize: number;
  requiresManualApproval: boolean;
  requiresDeposit: boolean;
  depositAmount: number;
  minimumNoticeMinutes: number;
  /** Scritto dal ristorante nel pannello: ogni sede ha la sua tolleranza. */
  punctualityNotice: string;
  calendarRules: BookingCalendarRules;
};

export function BookingWizard({ dictionary, locale, location, features }: { dictionary: Dictionary; locale: "it" | "en" | "es"; location: RestaurantLocation; features: BookingFeatures }) {
  const t = dictionary.booking;
  const details = detailCopy[locale];
  const flow = flowCopy[locale];
  const [step, setStep] = useState(1);
  const [partySize, setPartySize] = useState(Math.max(2, features.minimumPartySize));
  const [partySizeSelected, setPartySizeSelected] = useState(false);
  const [date, setDate] = useState(() => firstBookableServiceDate(features.calendarRules));
  const [requestedTime, setRequestedTime] = useState("20:00");
  const [slots, setSlots] = useState<PublicAvailabilityOption[]>([]);
  const [selected, setSelected] = useState<PublicAvailabilityOption | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [waitlistMode, setWaitlistMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [manualReviewRequired, setManualReviewRequired] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  // La ricevuta si prepara da sola appena esiste il codice, e vive come
  // immagine dentro la pagina: vedi `receipt` più sotto.
  const [receipt, setReceipt] = useState<{ blob: Blob; url: string } | null>(null);
  const [receiptState, setReceiptState] = useState<"working" | "ready" | "failed">("working");
  const [fields, setFields] = useState<Fields>({ firstName: "", lastName: "", phone: "", email: "", notes: "", allergies: "", accessibilityNeeds: "", privacyConsent: false, marketingConsent: false });
  const sessionId = useMemo(() => `web_${crypto.randomUUID()}`, []);
  // Non un `useMemo`: chi prenota due volte di fila deve ottenere due
  // prenotazioni, e una chiave riusata restituirebbe in silenzio la prima.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const hasMountedBookingFlow = useRef(false);
  const requiresManualHandling = features.requiresManualApproval || features.requiresDeposit;
  const selectedDateLabel = date ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${date}T12:00:00`)) : flow.dateNotSelected;
  const depositAmount = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(features.depositAmount);
  const hasPhone = Boolean(location.phoneHref);

  useEffect(() => {
    if (!hasMountedBookingFlow.current) {
      hasMountedBookingFlow.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById("booking-content")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  async function loadSlots() {
    if (!date) return;
    if (holdId) await releaseCurrentHold();
    setSlots([]); setSelected(null); setHoldId(null); setError(null); setRestrictions([]); setManualReviewRequired(false);
    setLoading(true);
    try {
      const response = await fetch("/api/public/v1/availability", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: location.id, date, partySize, source: "web" }) });
      const payload = await response.json() as { success: boolean; data?: PublicAvailabilityResult; error?: { message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? t.error);
      setSlots(payload.data.availableOptions);
      setRestrictions(payload.data.restrictions ?? []);
      setManualReviewRequired(payload.data.requiresManualApproval);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setLoading(false); }
  }

  /**
   * L'orario scelto: la disponibilità viene riservata subito e si passa ai dati.
   *
   * Il cliente non sceglie il tavolo. Quale sia è una decisione di sala — la
   * fanno gli accostamenti, i gruppi che arrivano dopo, chi non si presenta —
   * e chiederla a chi prenota aggiungeva un passaggio in cui si poteva solo
   * sbagliare. Senza `tableSelectionId` il server assegna da sé, ed è la stessa
   * assegnazione che lo staff può poi cambiare dal pannello.
   */
  async function chooseSlot(slot: PublicAvailabilityOption) {
    if (!date) return;
    setLoading(true); setError(null);
    try {
      if (holdId) await releaseCurrentHold();
      const response = await fetch("/api/public/v1/holds", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: location.id, date, partySize, source: "web", startAt: slot.startAt, sessionId }) });
      const payload = await response.json() as { success: boolean; data?: { id: string }; error?: { code?: string; message: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? t.error);
      setSelected(slot); setHoldId(payload.data.id); setWaitlistMode(false); setStep(2);
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setLoading(false); }
  }

  async function releaseCurrentHold() {
    const currentHoldId = holdId;
    setHoldId(null);
    setSelected(null);
    if (!currentHoldId) return;
    await fetch("/api/public/v1/holds", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdId: currentHoldId, locationId: location.id, sessionId }) }).catch(() => undefined);
  }

  function validateDetails() {
    if (fields.firstName.trim().length < 2 || fields.lastName.trim().length < 2 || fields.phone.trim().length < 6 || !fields.privacyConsent) {
      setError(locale === "it" ? "Completa i campi obbligatori e accetta l'informativa privacy." : t.error); return false;
    }
    // L'email è facoltativa, ma se c'è deve essere scritta bene: un indirizzo
    // storto è peggio di nessun indirizzo, perché sembra un recapito valido.
    if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email.trim())) {
      setError(flow.emailInvalid); return false;
    }
    setError(null); return true;
  }

  async function finish() {
    setLoading(true); setError(null);
    try {
      if (waitlistMode) {
        if (!date) throw new Error(t.error);
        const response = await fetch("/api/public/v1/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: location.id, firstName: fields.firstName, lastName: fields.lastName, phone: fields.phone, requestedDate: date, requestedTime, partySize, flexibilityMinutes: 60, notes: fields.notes, privacyConsent: fields.privacyConsent }) });
        const payload = await response.json() as { success: boolean; data?: { id: string }; error?: { message: string } };
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? t.error);
        setCompletion({ type: "waitlist", id: payload.data.id });
      } else {
        if (!holdId) throw new Error(t.error);
        const response = await fetch("/api/public/v1/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ locationId: location.id, holdId, idempotencyKey, customer: { firstName: fields.firstName, lastName: fields.lastName, phone: fields.phone, email: fields.email.trim() || undefined, preferredLanguage: locale, marketingConsent: fields.marketingConsent, privacyConsent: fields.privacyConsent, allergies: fields.allergies || undefined, accessibilityNeeds: fields.accessibilityNeeds || undefined }, customerNotes: fields.notes || undefined }) });
        const payload = await response.json() as { success: boolean; data?: { reservation: { reservationCode: string }; managementToken: string }; error?: { message: string } };
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? t.error);
        setCompletion({ type: "reservation", code: payload.data.reservation.reservationCode, token: payload.data.managementToken });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t.error); }
    finally { setLoading(false); }
  }

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) { setFields((current) => ({ ...current, [key]: value })); }

  /**
   * La ricevuta si disegna da sola appena la prenotazione esiste.
   *
   * Prima si disegnava alla pressione del pulsante, e lì stava il guasto: fra
   * il tocco e la consegna c'erano il caricamento del logo e `toBlob`, cioè
   * abbastanza attese perché il browser considerasse **finito il gesto
   * dell'utente**. Senza gesto valido iOS ignora in silenzio il `download` di
   * un link e blocca `window.open`: non si scaricava e non si apriva niente,
   * mentre il codice annunciava "Immagine salvata".
   *
   * Preparandola qui, il pulsante non deve più aspettare nulla e la consegna
   * parte dentro il gesto. E soprattutto l'immagine è già **visibile nella
   * pagina**: su iPhone si tiene premuta e si salva in Foto, che è l'unica via
   * che nessuna webview può togliere.
   */
  useEffect(() => {
    if (!completion || completion.type !== "reservation") return;
    let cancelled = false;
    let created: string | null = null;
    // Niente `setReceiptState("working")` qui: è già lo stato iniziale, e
    // `startNewBooking` lo riporta lì. Scriverlo dentro l'effetto costerebbe un
    // render in più per dire una cosa già vera.
    void (async () => {
      try {
        const blob = await drawReceipt({
          reservationCode: completion.code,
          restaurantName: location.name,
          restaurantCity: location.city,
          dateLabel: selectedDateLabel,
          timeLabel: selected ? formatTimeInZone(selected.startAt) : requestedTime,
          partyLabel: `${partySize} ${dictionary.common.guests}`,
          guestName: `${fields.firstName} ${fields.lastName}`.trim(),
          punctualityNotice: features.punctualityNotice,
          accentColor: location.accentColor,
          logoUrl: location.logoPath,
          labels: { title: flow.receiptTitle, code: t.code, restaurant: "Ristorante", date: t.fieldDate, time: t.fieldTime, party: t.fieldParty, guest: "Intestatario", punctuality: "Puntualità" },
        });
        if (cancelled) return;
        if (!blob) { setReceiptState("failed"); return; }
        created = URL.createObjectURL(blob);
        setReceipt({ blob, url: created });
        setReceiptState("ready");
      } catch { if (!cancelled) setReceiptState("failed"); }
    })();
    return () => { cancelled = true; if (created) URL.revokeObjectURL(created); };
    // Il codice è l'unica cosa che deve far ridisegnare: il resto è già fermo
    // quando la schermata di conferma compare.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completion]);

  /**
   * Ricominciare da capo dopo aver prenotato.
   *
   * Senza questo l'unica via era ricaricare la pagina: i pulsanti in cima
   * portano tutti a `#booking-content`, che sulla schermata di conferma non
   * esisteva, e il collegamento del logo rimanda a questo stesso indirizzo
   * lasciando lo stato dov'era. Sembravano pulsanti rotti.
   */
  function startNewBooking() {
    setCompletion(null);
    setReceipt(null);
    setReceiptState("working");
    setIdempotencyKey(crypto.randomUUID());
    setStep(1);
    setPartySize(Math.max(2, features.minimumPartySize));
    setPartySizeSelected(false);
    setDate(firstBookableServiceDate(features.calendarRules));
    setSlots([]); setSelected(null); setHoldId(null);
    setWaitlistMode(false); setError(null); setRestrictions([]); setManualReviewRequired(false);
    setFields({ firstName: "", lastName: "", phone: "", email: "", notes: "", allergies: "", accessibilityNeeds: "", privacyConsent: false, marketingConsent: false });
    // Gli orari vanno richiesti di nuovo anche se persone e data coincidono con
    // quelle di prima: nel frattempo il posto appena preso non è più libero.
    lastLoadedKey.current = null;
  }

  /** Parte dentro il gesto: il blob è già pronto, non c'è niente da aspettare. */
  function saveReceipt(code: string) {
    if (!receipt) return;
    void deliverReceipt(receipt.blob, receiptFileName(code));
  }

  // Persone e data sono le uniche due informazioni che servono per sapere cosa
  // è libero: appena ci sono, gli orari arrivano da soli. Chiedere due click su
  // "Continua" per ottenerli erano due passaggi a vuoto.
  const availabilityKey = partySizeSelected && date ? `${partySize}|${date}` : null;
  const lastLoadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!availabilityKey || lastLoadedKey.current === availabilityKey) return;
    lastLoadedKey.current = availabilityKey;
    void loadSlots();
  });

  if (!features.onlineBookingEnabled) {
    return <section id="booking-content" className="mx-auto max-w-2xl px-5 py-16 text-center sm:py-24"><div className="surface-3d rounded-3xl border bg-card p-8 sm:p-12"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PhoneCall className="size-6" /></span><p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prenotazioni online sospese</p><h2 className="mt-3 font-heading text-4xl">Siamo a tua disposizione.</h2><p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">Per questa data o fascia il ristorante gestisce le richieste direttamente con il personale.</p>{hasPhone ? <Button asChild size="lg" className="mt-7"><a href={location.phoneHref}><PhoneCall />Chiama {location.phone}</a></Button> : <p className="mt-7 text-sm text-muted-foreground">I recapiti del ristorante saranno disponibili a breve.</p>}</div></section>;
  }

  if (completion) {
    const calendarUrl = selected ? buildGoogleCalendarUrl({ location, selected, partySize, customerName: `${fields.firstName} ${fields.lastName}` }) : undefined;
    const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
    // L'ancora vive anche qui: i pulsanti "Inizia la prenotazione" in cima
    // puntano a questo identificatore e senza di esso non facevano nulla.
    return <section id="booking-content" tabIndex={-1} className="mx-auto max-w-2xl scroll-mt-14 px-5 py-16 text-center outline-none sm:py-24" aria-live="polite">
      <div className="surface-3d mx-auto overflow-hidden rounded-xl border border-white/10 bg-card px-6 py-10 sm:px-12 sm:py-14">
      <div className="signal-pulse mx-auto mb-7 flex size-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-300"><CheckCircle2 className="size-8" /></div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.24em] text-primary">{completion.type === "reservation" ? t.code : t.waitlist}</p>
      <h1 className="font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{completion.type === "reservation" ? t.confirmed : t.waitlist}</h1>
      {completion.type === "reservation" ? <>
        <p className="mx-auto mt-6 max-w-md text-sm leading-6 text-muted-foreground">La prenotazione è entrata nella regia di <span className="font-medium text-foreground">{location.name}</span>.</p>
        <div className="my-7 border border-primary/35 bg-primary/8 px-5 py-4"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Codice prenotazione</p><p className="mt-2 font-mono text-3xl font-semibold tracking-[0.14em] text-foreground">{completion.code}</p></div>
        {/* Senza email di conferma il codice esiste solo su questo schermo:
            l'avviso deve essere impossibile da scavalcare distrattamente. */}
        <div role="alert" className="mb-7 flex items-start gap-3 rounded-xl border-2 border-amber-400/50 bg-amber-400/10 p-4 text-left">
          <Camera className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">{flow.saveCodeTitle}</p>
            <p className="mt-1 text-xs leading-5 text-amber-100/75">{flow.saveCodeBody}</p>
          </div>
        </div>
        <div className="mx-auto mb-7 max-w-md divide-y divide-white/8 border border-white/10 bg-[#0d0e0d] text-left">
          <SummaryCell label="Ristorante" value={location.name} />
          <SummaryCell label={t.fieldDate} value={selectedDateLabel} />
          <SummaryCell label={t.fieldTime} value={selected ? formatTimeInZone(selected.startAt) : requestedTime} />
          <SummaryCell label={t.fieldParty} value={`${partySize} ${dictionary.common.guests}`} />
          <SummaryCell label="Intestatario" value={`${fields.firstName} ${fields.lastName}`} />
        </div>
        <div className="mx-auto mb-7 max-w-md text-left"><PunctualityNotice text={features.punctualityNotice} /></div>
        {/* La ricevuta sta nella pagina, non dietro un pulsante: è ciò che
            sostituisce l'email di conferma che non arriverà, e un'immagine che
            si vede si può sempre tenere premuta e salvare — anche dove il
            download di un file viene ignorato. */}
        <div className="mb-7">
          {receiptState === "working" && <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/15 text-sm text-muted-foreground"><LoaderCircle className="mr-2 size-4 animate-spin" />{flow.receiptWorking}</div>}
          {receiptState === "failed" && <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-left text-xs leading-5 text-amber-100/85">{flow.receiptFailed}</p>}
          {receiptState === "ready" && receipt && <>
            {/* Non `next/image`: la sorgente è un blob creato qui, che
                l'ottimizzatore non può né conoscere né servire. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.url} alt={flow.receiptAlt} className="w-full rounded-xl border border-white/10" />
            <p className="mt-2.5 text-xs leading-5 text-muted-foreground">{flow.receiptHint}</p>
            <Button size="lg" onClick={() => saveReceipt(completion.code)} className="mt-3 min-h-14 w-full text-base"><Download />{flow.receiptSave}</Button>
          </>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2"><Button asChild size="lg" variant="outline"><Link href={`/${locale}/booking/manage/${completion.token}`}>{t.manage}<ArrowRight /></Link></Button>{calendarUrl && <Button asChild size="lg" variant="outline"><a href={calendarUrl} target="_blank" rel="noreferrer"><CalendarPlus />Aggiungi al calendario</a></Button>}<Button asChild variant="outline"><a href={directionsUrl} target="_blank" rel="noreferrer"><Navigation />Indicazioni</a></Button>{hasPhone && <Button asChild variant="ghost"><a href={location.phoneHref}><PhoneCall />Chiama {location.shortName}</a></Button>}</div>
        <Button variant="ghost" onClick={startNewBooking} className="mt-3 w-full text-muted-foreground"><CalendarDays />{flow.newBooking}</Button>
      </> : <><p className="mx-auto my-8 max-w-md text-muted-foreground">Ti contatteremo appena si apre una disponibilità compatibile con la tua richiesta.</p><p className="font-mono text-xs text-muted-foreground">ID {completion.id.slice(0, 8).toUpperCase()}</p>{hasPhone && <Button asChild variant="outline" className="mt-7"><a href={location.phoneHref}><PhoneCall />Chiama {location.shortName}</a></Button>}<Button variant="ghost" onClick={startNewBooking} className="mt-3 w-full text-muted-foreground"><CalendarDays />{flow.newBooking}</Button></>}
      </div>
    </section>;
  }

  // La barra di avanzamento va a filo schermo con un margine negativo fisso di
  // 20px, ma il padding effettivo del contenitore non è sempre esattamente
  // quello: la differenza usciva dallo schermo come scroll orizzontale.
  return <div id="booking-content" tabIndex={-1} className="mx-auto grid max-w-6xl scroll-mt-14 gap-12 overflow-x-clip px-5 py-10 outline-none lg:grid-cols-[minmax(0,1fr)_340px] lg:py-16">
    <main>
      <div className="sticky top-[59px] z-30 -mx-5 mb-5 border-y border-border/70 bg-background/95 px-5 py-3 text-xs shadow-[0_8px_18px_-18px_rgba(0,0,0,.8)] backdrop-blur sm:static sm:mx-0 sm:mb-3 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none" aria-live="polite">
        <div className="flex items-center justify-between gap-4">
          <span className="font-mono uppercase tracking-[0.16em] text-muted-foreground">Passaggio {step} di {t.steps.length}</span>
          <span className="truncate font-medium">{t.steps[step - 1]}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden bg-border sm:hidden"><span className="block h-full bg-primary transition-[width] duration-300" style={{ width: `${(step / t.steps.length) * 100}%` }} /></div>
      </div>
      <ol className="relative mb-10 grid gap-2 sm:mb-12" style={{ gridTemplateColumns: `repeat(${t.steps.length}, minmax(0, 1fr))` }} aria-label="Progresso prenotazione">
        <div aria-hidden className="absolute left-[16%] right-[16%] top-4 h-px bg-border" />
        <div aria-hidden className="absolute left-[16%] top-4 h-px bg-primary transition-[width] duration-500" style={{ width: `${(Math.max(0, step - 1) / Math.max(1, t.steps.length - 1)) * 68}%` }} />
        {t.steps.map((label, index) => { const number = index + 1; const done = number < step; return <li key={label} aria-current={number === step ? "step" : undefined} className="relative z-10 min-w-0 text-center">
          <span className={cn("mx-auto flex size-8 items-center justify-center rounded-full border bg-background font-mono text-[10px] transition-colors", number === step ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/10" : done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{done ? <Check className="size-3.5" /> : number}</span>
          <span className={cn("mt-3 hidden truncate text-[11px] sm:block", number === step ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          <span className="sr-only">{number === step ? "Passaggio corrente: " : ""}{label}</span>
        </li>; })}
      </ol>

      {step === 1 && <Step step={1} title={t.bookingTitle} icon={<CalendarDays />}>
        <p id="party-size-hint" className="-mt-4 mb-5 text-sm text-muted-foreground">{flow.partySizeRequired}</p>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.fieldParty}</p>
        <div role="group" aria-label={t.partyTitle} aria-describedby="party-size-hint" className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <button key={value} type="button" disabled={value < features.minimumPartySize} onClick={() => { setPartySize(value); setPartySizeSelected(true); }} aria-pressed={partySizeSelected && partySize === value} className="tile flex aspect-square min-h-12 items-center justify-center font-mono text-xl font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30">{value}</button>)}
          <button type="button" onClick={() => { setPartySize(11); setPartySizeSelected(true); }} aria-pressed={partySizeSelected && partySize > 10} className="tile col-span-5 min-h-12 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2">{t.partyMore}</button>
        </div>
        {partySizeSelected && partySize > 10 && <div className="mt-5 max-w-xs"><Label htmlFor="large-party-size">{flow.exactPartySize}</Label><Input id="large-party-size" type="number" min={11} max={100} value={partySize} onChange={(event) => { setPartySize(Math.max(11, Number(event.target.value))); setPartySizeSelected(true); }} className="mt-2 h-12 bg-card"/></div>}
        {requiresManualHandling && <p className="mt-5 flex items-start gap-2 rounded-xl border border-accent/35 bg-accent/15 p-4 text-sm"><Info className="mt-0.5 size-4 shrink-0" />{features.requiresDeposit ? flow.deposit(depositAmount) : flow.staffReview}</p>}

        {date ? <div className="mt-9 border-t pt-8">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.fieldDate}</p>
          <BookingDatePicker value={date} onChange={setDate} locale={locale} rules={features.calendarRules} minimumNoticeMinutes={features.minimumNoticeMinutes} />
        </div> : <div className="surface-3d mt-9 max-w-xl rounded-3xl border border-dashed bg-card p-6 text-center sm:p-8"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PhoneCall className="size-5" /></span><h3 className="mt-5 font-heading text-2xl">{flow.noBookableDateTitle}</h3><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{flow.noBookableDateDescription}</p>{hasPhone ? <Button asChild variant="outline" className="mt-6"><a href={location.phoneHref}><PhoneCall />{flow.callRestaurant}</a></Button> : <p className="mt-6 text-sm text-muted-foreground">I recapiti saranno disponibili a breve.</p>}</div>}

        {date && <div className="mt-9 border-t pt-8" aria-live="polite">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.fieldTime}</p>
          {!partySizeSelected
            ? <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="size-3.5 shrink-0" />{flow.partySizeRequired}</p>
            : <><p className="mb-6 text-sm text-muted-foreground">{t.timeHint}</p>
        {loading && <div className="flex h-36 items-center justify-center text-muted-foreground"><LoaderCircle className="mr-2 size-5 animate-spin" />{t.loading}</div>}
        {!loading && slots.length > 0 && <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">{slots.map((slot) => { const isChosen = selected?.startAt === slot.startAt; return <button type="button" key={slot.startAt} onClick={() => void chooseSlot(slot)} disabled={loading} aria-pressed={isChosen} className={cn("tile group min-h-[5.25rem] px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50", isChosen && "border-primary ring-2 ring-primary/25")}><span className="flex items-center justify-between gap-2"><span className="font-mono text-2xl font-semibold tracking-tight">{formatTimeInZone(slot.startAt)}</span>{isChosen ? <Check className="size-4 text-primary" /> : <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}</span><span className="mt-2 block text-[11px] leading-4 text-muted-foreground">{slot.durationMinutes} min · {flow.instantConfirmation}</span></button>; })}</div>}
        {!loading && slots.length === 0 && <div className="surface-3d rounded-2xl border border-dashed bg-card/70 p-6"><p className="font-medium">{requiresManualHandling || manualReviewRequired ? flow.staffReviewTitle : t.unavailable}</p><p className="mt-2 text-sm text-muted-foreground">{requiresManualHandling || manualReviewRequired ? flow.staffReviewDescription : features.waitlistEnabled ? flow.waitlistDescription : flow.waitlistDisabled}</p>{restrictions.length > 0 && <ul className="mt-4 space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-muted-foreground">{restrictions.map((restriction) => <li key={restriction} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-amber-600" />{restriction}</li>)}</ul>}<div className="mt-5 flex flex-wrap items-end gap-3">{features.waitlistEnabled ? <><div><Label htmlFor="requested-time" className="text-xs">{flow.preferredTime}</Label><Input id="requested-time" type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} className="mt-2 w-36 bg-background" /></div><Button variant="outline" onClick={() => { setWaitlistMode(true); setStep(2); }}>{requiresManualHandling || manualReviewRequired ? flow.sendStaffRequest : t.waitlist}</Button></> : hasPhone ? <Button asChild variant="outline"><a href={location.phoneHref}><PhoneCall />{flow.callRestaurant}</a></Button> : <p className="text-sm text-muted-foreground">I recapiti saranno disponibili a breve.</p>}</div></div>}
            </>}
        </div>}

      </Step>}

      {step === 2 && <Step step={2} title={t.detailsTitle} icon={<ShieldCheck />}>
        {!waitlistMode && selected && <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-700/20 bg-emerald-700/8 p-4 text-sm"><span className="signal-pulse mt-1 size-2 shrink-0 rounded-full bg-emerald-600" /><div><p className="font-semibold">Orario temporaneamente riservato</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Completa i dati per confermare l’orario delle {formatTimeInZone(selected.startAt)}.</p></div></div>}
        {/* Detto qui, prima che il cliente compili: a fine flusso il codice
            esiste solo sullo schermo e va salvato da lui. */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4"><Camera className="mt-0.5 size-4 shrink-0 text-amber-300" /><p className="text-xs leading-5 text-amber-100/85">{flow.saveCodeEarly}</p></div>
        <div className="rounded-2xl border bg-card/70 p-5 sm:p-6"><p className="mb-5 flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-primary" />Contatto della prenotazione</p><div className="grid gap-5 sm:grid-cols-2"><Field id="firstName" label={t.firstName} value={fields.firstName} onChange={(value) => setField("firstName", value)} autoComplete="given-name" required /><Field id="lastName" label={t.lastName} value={fields.lastName} onChange={(value) => setField("lastName", value)} autoComplete="family-name" required /><Field id="phone" label={t.phone} value={fields.phone} onChange={(value) => setField("phone", value)} type="tel" autoComplete="tel" required /><Field id="email" label={`${t.email} (${details.optional})`} value={fields.email} onChange={(value) => setField("email", value)} type="email" autoComplete="email" /></div></div>
        <div className="mt-4 rounded-2xl border bg-card/70 p-5 sm:p-6"><p className="mb-5 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Preferenze per il servizio</p><div><Label htmlFor="notes">{details.notes} <span className="font-normal text-muted-foreground">({details.optional})</span></Label><Textarea id="notes" value={fields.notes} onChange={(event) => setField("notes", event.target.value)} className="mt-2 min-h-24 bg-background" placeholder="Es. compleanno, seggiolone o richiesta particolare…" /></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field id="allergies" label={`${details.allergies} (${details.optional})`} value={fields.allergies} onChange={(value) => setField("allergies", value)} /><Field id="accessibilityNeeds" label={`${details.accessibility} (${details.optional})`} value={fields.accessibilityNeeds} onChange={(value) => setField("accessibilityNeeds", value)} /></div></div>
        {/* Il consenso deve poter essere informato nel momento in cui lo si dà:
            il collegamento nel piè di pagina è troppo lontano dalla casella, e
            la versione dell'informativa è quella che finisce registrata. */}
        <div className="mt-6 space-y-4"><CheckRow id="privacy" checked={fields.privacyConsent} onCheckedChange={(value) => setField("privacyConsent", value)} required label={<>{t.privacy}{" "}<Link href={`/${locale}/privacy`} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-primary">{flow.privacyRead}</Link>{" "}<span className="text-muted-foreground">({flow.privacyVersion(privacyPolicyVersion)})</span></>} /><CheckRow id="marketing" checked={fields.marketingConsent} onCheckedChange={(value) => setField("marketingConsent", value)} label={t.marketing} /></div>
        <StepActions back={() => { setStep(1); void releaseCurrentHold(); }} next={() => { if (validateDetails()) setStep(3); }} nextLabel={t.continue} backLabel={t.back} />
      </Step>}

      {step === 3 && <Step step={3} title={t.reviewTitle} icon={<Sparkles />}>
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/8 p-4 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="font-semibold">Ultimo controllo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Confermando, la prenotazione entra subito nella regia operativa.</p></div></div>
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm"><Camera className="mt-0.5 size-4 shrink-0 text-amber-300" /><p className="text-xs leading-5 text-amber-100/85">{flow.noEmailNotice}</p></div>
        {/* Va letto prima di confermare, non dopo: è l'unica condizione che
            può far perdere il tavolo. */}
        <PunctualityNotice text={features.punctualityNotice} />
        <dl className="surface-3d divide-y rounded-2xl border bg-card px-5">{[
          [t.fieldParty, `${partySize} ${dictionary.common.guests}`], [t.fieldDate, selectedDateLabel], [t.fieldTime, selected ? formatTimeInZone(selected.startAt) : requestedTime], [t.firstName, `${fields.firstName} ${fields.lastName}`], [t.phone, fields.phone], ...(fields.allergies ? [[details.allergies, fields.allergies]] : []), ...(fields.accessibilityNeeds ? [[details.accessibility, fields.accessibilityNeeds]] : []),
        ].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_1fr] gap-4 py-4 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
        {/* Tornava al passaggio 4, che non esiste: la pagina restava vuota e
            la prenotazione moriva lì. */}
        <StepActions back={() => setStep(2)} next={finish} nextLabel={t.confirm} backLabel={t.back} loading={loading} />
      </Step>}
      {error && <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    </main>

    <aside className="hidden lg:block"><div className="surface-3d sticky top-8 overflow-hidden rounded-xl border bg-card">
      <div className="relative overflow-hidden bg-[#111311] p-6 text-white"><div aria-hidden className="absolute -right-16 -top-20 size-48 rounded-full bg-primary/12 blur-2xl" /><div className="relative"><div className="flex items-center justify-between"><p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">{location.shortName}</p><span className="flex items-center gap-1.5 text-[10px] text-emerald-300"><span className="signal-pulse size-1.5 rounded-full bg-emerald-400" />Live</span></div><h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight">{location.name}</h2><p className="mt-2 text-xs text-white/45">Riepilogo aggiornato automaticamente</p></div></div>
      <div className="space-y-5 p-6 text-sm"><SummaryLine icon={<UsersRound />} label={t.fieldParty} value={partySizeSelected ? `${partySize} ${dictionary.common.guests}` : flow.dateNotSelected} active={partySizeSelected} /><SummaryLine icon={<CalendarDays />} label={t.fieldDate} value={selectedDateLabel} active={Boolean(date)} /><SummaryLine icon={<Clock3 />} label={t.fieldTime} value={selected ? formatTimeInZone(selected.startAt) : flow.dateNotSelected} active={Boolean(selected)} /><SummaryLine icon={<ShieldCheck />} label="Stato" value={selected ? "Orario riservato" : "In attesa di scelta"} active={Boolean(selected)} />
        <div className="border-t pt-5 text-xs leading-5 text-muted-foreground"><Accessibility className="mb-2 size-4 text-primary" />Allergie e accessibilità arrivano evidenziate nella scheda operativa dello staff.</div>
      </div>
    </div></aside>
  </div>;
}

function Step({ title, icon, step, children }: { title: string; icon: React.ReactNode; step: number; children: React.ReactNode }) {
  // Il ritaglio sta sul solo numero decorativo: messo sulla scheda intera
  // faceva di questa sezione un contenitore di scorrimento, e la barra
  // d'azione appiccicata in fondo smetteva di seguire il pollice.
  return <section className="lacquer lacquer-spine p-5 sm:p-8">
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-clip"><span className="ghost-numeral font-mono">{step}</span></span>
    <div className="relative mb-7 flex items-start gap-3.5 text-primary sm:items-center sm:gap-4">
      <span className="flex size-10 shrink-0 items-center justify-center border border-primary/25 bg-primary/10 sm:size-11 [&_svg]:size-5">{icon}</span>
      {/* Niente "Passaggio N" qui: la barra di avanzamento sopra lo dice già
          due volte, e ripeterlo una terza rubava solo spazio allo schermo. */}
      <h2 className="min-w-0 text-balance font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-4xl">{title}</h2>
    </div>
    <div className="relative">{children}</div>
  </section>;
}

function StepActions({ back, next, backLabel, nextLabel, disabled, loading }: { back?: () => void; next?: () => void; backLabel?: string; nextLabel?: string; disabled?: boolean; loading?: boolean }) {
  return <div className="step-actions flex gap-3 sm:items-center sm:justify-between">
    {back ? <Button variant="outline" onClick={back} className="min-h-12 flex-1 sm:w-auto sm:flex-none"><ArrowLeft />{backLabel}</Button> : <span className="hidden sm:block" />}
    {next && <Button size="lg" onClick={next} disabled={disabled || loading} className="min-h-12 flex-[1.6] sm:w-auto sm:flex-none">{loading ? <LoaderCircle className="animate-spin" /> : null}{nextLabel}<ArrowRight /></Button>}
  </div>;
}
function Field({ id, label, value, onChange, type = "text", autoComplete, required }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; required?: boolean }) { return <div><Label htmlFor={id}>{label}{required ? " *" : ""}</Label><Input id={id} type={type} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined} autoComplete={autoComplete} autoCapitalize={type === "email" || type === "tel" ? "none" : "words"} enterKeyHint={type === "tel" || type === "email" ? "next" : undefined} value={value} onChange={(event) => onChange(event.target.value)} required={required} aria-required={required} className="mt-2 h-12 bg-background" /></div>; }
function CheckRow({ id, checked, onCheckedChange, label, required }: { id: string; checked: boolean; onCheckedChange: (value: boolean) => void; label: React.ReactNode; required?: boolean }) { return <div className="flex items-start gap-3"><Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} aria-required={required} /><Label htmlFor={id} className="text-sm font-normal leading-5">{label}{required ? " *" : ""}</Label></div>; }
function SummaryLine({ icon, label, value, active }: { icon: React.ReactNode; label: string; value: string; active?: boolean }) { return <div className="grid grid-cols-[32px_1fr] gap-3"><span className={cn("flex size-8 items-center justify-center rounded-lg [&_svg]:size-4", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div></div>; }
function PunctualityNotice({ text }: { text: string }) {
  if (!text.trim()) return null;
  return <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-400/35 bg-sky-400/8 p-4">
    <Clock3 className="mt-0.5 size-4 shrink-0 text-sky-300" />
    <div><p className="text-sm font-semibold text-sky-100">Puntualità</p><p className="mt-1 text-xs leading-5 text-sky-100/80">{text}</p></div>
  </div>;
}
function SummaryCell({ label, value }: { label: string; value: string }) { return <div className="bg-transparent px-4 py-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>; }

function buildGoogleCalendarUrl({ location, selected, partySize, customerName }: { location: RestaurantLocation; selected: PublicAvailabilityOption; partySize: number; customerName: string }) {
  const toCalendarDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Prenotazione · ${location.name}`,
    dates: `${toCalendarDate(selected.startAt)}/${toCalendarDate(selected.endAt)}`,
    details: `Prenotazione per ${partySize} persone a nome ${customerName}.`,
    location: location.address,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
