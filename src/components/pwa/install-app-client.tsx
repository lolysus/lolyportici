"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, Check, Download, LoaderCircle, LogIn, Share, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type Restaurant = {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  accent: string;
  accentForeground: string;
  surface: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function detectPlatform() {
  if (typeof navigator === "undefined") return { ios: false, android: false, iosOtherBrowser: false };
  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /android/i.test(ua);
  // Su iPhone solo Safari crea una PWA che riceve notifiche. Chrome, Firefox o
  // Edge su iOS (crios/fxios/edgios) non hanno "Aggiungi a Home" utile: chi apre
  // il link lì va mandato in Safari, altrimenti installa un'app muta.
  const iosOtherBrowser = ios && /crios|fxios|edgios|opios/i.test(ua);
  return { ios, android, iosOtherBrowser };
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppClient({ restaurant, authenticated, staffName, loginHref, agendaHref }: {
  restaurant: Restaurant;
  authenticated: boolean;
  staffName: string | null;
  loginHref: string;
  agendaHref: string;
}) {
  const [ready, setReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [platform, setPlatform] = useState({ ios: false, android: false, iosOtherBrowser: false });
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testDone, setTestDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Su iPhone il pulsante "Installa" non può installare da solo (Apple lo
  // vieta): al tocco mostra gli ultimi due passaggi obbligati in Safari.
  const [iosGuide, setIosGuide] = useState(false);
  // La disponibilità delle push si chiede al backend (Railway), non si deduce
  // dall'ambiente della pagina (Vercel), dove le chiavi VAPID non arrivano: la
  // chiave pubblica c'è → le notifiche sono configurate. `null` = ancora ignoto.
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [pushAvailable, setPushAvailable] = useState<boolean | null>(null);

  const supportsPush = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  useEffect(() => {
    let cancelled = false;
    // Le letture del browser (standalone, piattaforma, permesso) non esistono
    // nel render sul server: rimandarle a un microtask le tiene fuori dal corpo
    // sincrono dell'effetto ed evita il render a cascata.
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setStandalone(isStandalone());
      setPlatform(detectPlatform());
      setPermission(supportsPush ? Notification.permission : "unsupported");
      // Chiede al backend se le notifiche sono configurate (chiave presente).
      try {
        const payload = await fetch("/api/push/vapid-public-key").then((r) => r.json()) as { data?: { publicKey?: string | null } };
        if (cancelled) return;
        const key = payload.data?.publicKey ?? null;
        setVapidKey(key);
        setPushAvailable(Boolean(key));
      } catch {
        if (!cancelled) setPushAvailable(false);
      }
      if (!cancelled) setReady(true);
    });

    if (supportsPush) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(async (reg) => {
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled && existing && Notification.permission === "granted") setSubscribed(true);
      }).catch(() => undefined);
    }

    const onInstalled = () => setStandalone(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [supportsPush]);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (!supportsPush) {
        setError("Questo browser non supporta le notifiche. Su iPhone aggiungi prima l’app alla schermata Home, poi aprila da lì.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const granted = await Notification.requestPermission();
      setPermission(granted);
      if (granted !== "granted") {
        setError(granted === "denied"
          ? "Le notifiche sono bloccate per questo sito. Riattivale dalle impostazioni del telefono per questa app."
          : "Permesso non concesso. Riprova e scegli “Consenti”.");
        return;
      }
      const publicKey = vapidKey ?? await fetch("/api/push/vapid-public-key")
        .then((r) => r.json())
        .then((p: { data?: { publicKey?: string | null } }) => p.data?.publicKey ?? null);
      if (!publicKey) { setError("Le notifiche non sono ancora configurate sul server."); return; }

      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      const json = subscription.toJSON();
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
      });
      if (!response.ok) {
        setError(response.status === 401
          ? "La sessione è scaduta: accedi di nuovo e riprova."
          : "Non è stato possibile registrare il dispositivo. Riprova.");
        return;
      }
      setSubscribed(true);
    } catch {
      setError("Attivazione non riuscita. Controlla la connessione e riprova.");
    } finally {
      setBusy(false);
    }
  }, [supportsPush, vapidKey]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    setTestDone(false);
    try {
      await fetch("/api/push/test", { method: "POST", headers: { "content-type": "application/json" } });
      setTestDone(true);
    } catch {
      // Una prova fallita non è un guasto da mostrare in rosso: riprovano.
    } finally {
      setTesting(false);
      window.setTimeout(() => setTestDone(false), 4000);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const subscription = await reg?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  const accentStyle = { "--app-accent": restaurant.accent, "--app-accent-fg": restaurant.accentForeground } as React.CSSProperties;
  const apkHref = `/app/${restaurant.slug}.apk`;

  return <main style={accentStyle} className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pb-16 pt-8">
    <header className="text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-2xl text-2xl font-bold shadow-lg" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>
        <BellRing className="size-7" />
      </span>
      <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight">App {restaurant.shortName}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Una notifica sul telefono a ogni nuova prenotazione di {restaurant.city}. Installala una volta e lasciala sullo schermo Home.
      </p>
    </header>

    {!ready && <div className="flex justify-center py-10 text-muted-foreground"><LoaderCircle className="size-6 animate-spin" /></div>}

    {ready && <>
      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm leading-6 text-destructive"><TriangleAlert className="mt-0.5 size-4 shrink-0" />{error}</p>}

      {!pushAvailable && <StatusCard tone="warning" icon={<TriangleAlert />} title="Notifiche non ancora attive sul server" body="La configurazione delle notifiche non è completa. Riprova più tardi o avvisa chi gestisce la piattaforma." />}

      {pushAvailable && subscribed && permission === "granted" && <>
        <StatusCard tone="success" icon={<Check />} title="Notifiche attive su questo dispositivo" body={`Ogni prenotazione di ${restaurant.shortName} farà squillare questo telefono, anche con l’app chiusa.`} />
        <div className="grid gap-2.5">
          <Button onClick={() => void sendTest()} disabled={testing} size="lg" className="min-h-12 w-full text-base" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>
            {testing ? <LoaderCircle className="animate-spin" /> : testDone ? <Check /> : <BellRing />}
            {testing ? "Invio…" : testDone ? "Inviata: guarda le notifiche" : "Invia una notifica di prova"}
          </Button>
          <Button asChild variant="outline" size="lg" className="min-h-12 w-full text-base"><Link href={agendaHref}>Apri l’agenda<ArrowRight /></Link></Button>
          <button type="button" onClick={() => void disable()} disabled={busy} className="mt-1 min-h-11 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Disattiva le notifiche su questo dispositivo</button>
        </div>
      </>}

      {pushAvailable && !(subscribed && permission === "granted") && <>
        {/* Android nel browser: l'app vera da scaricare, il percorso che l'utente
            ha chiesto. Un tap scarica l'APK, poi si installa e si attivano le
            notifiche da dentro. */}
        {platform.android && !standalone && <>
          <StatusCard tone="neutral" icon={<Download />} title={`Scarica l’app ${restaurant.shortName} per Android`} body="Un’app vera sulla schermata Home. Ti bastano tre passaggi." />
          <Button asChild size="lg" className="min-h-14 w-full text-base font-semibold" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>
            <a href={apkHref} download>{<Download />}Scarica l’app (APK)</a>
          </Button>
          <ol className="space-y-3">
            <Step n={1}>Apri il file scaricato e tocca <strong>Installa</strong>. Se il telefono lo chiede, consenti l’installazione <strong>“da questa origine”</strong> (è un passaggio normale di Android).</Step>
            <Step n={2}>Apri l’app <strong>{restaurant.shortName}</strong> appena installata.</Step>
            <Step n={3}>Accedi e tocca <strong>“Attiva le notifiche”</strong>. Fatto.</Step>
          </ol>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Preferisci non installare?{" "}
            {authenticated
              ? <button type="button" onClick={() => void enable()} disabled={busy} className="underline underline-offset-4 hover:text-foreground">Attiva le notifiche nel browser</button>
              : <Link href={loginHref} className="underline underline-offset-4 hover:text-foreground">Accedi e attivale nel browser</Link>}
          </p>
        </>}

        {!(platform.android && !standalone) && <>
          {/* iPhone non ancora installato: i passaggi per aggiungere l'app alla
              Home NON richiedono l'accesso — chiunque può installare il guscio,
              poi accede e attiva le notifiche da dentro. Prima era tutto dietro
              il login, e da iPhone sembrava che non si potesse installare. */}
          {platform.ios && !standalone && platform.iosOtherBrowser && <>
            <StatusCard tone="warning" icon={<TriangleAlert />} title="Apri questo link in Safari" body="Su iPhone solo Safari può installare l’app che riceve le notifiche. In questo browser non funziona." />
            <ol className="space-y-3">
              <Step n={1}>Tocca il menu <strong>⋯</strong> in alto e scegli <strong>“Apri in Safari”</strong>. Oppure copia l’indirizzo e incollalo in Safari.</Step>
              <Step n={2}>In Safari torna su questa pagina e segui i tre tocchi per aggiungere l’app.</Step>
            </ol>
          </>}

          {platform.ios && !standalone && !platform.iosOtherBrowser && <>
            <Button onClick={() => setIosGuide(true)} size="lg" className="min-h-14 w-full text-base font-semibold" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>
              <Download />Installa l’app {restaurant.shortName}
            </Button>
            {!iosGuide
              ? <p className="text-center text-xs leading-5 text-muted-foreground">Un’app vera sulla schermata Home, veloce e con le notifiche. Tocca il pulsante e completa in Safari.</p>
              : <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-4">
                  <p className="text-sm font-semibold">Ultimi due tocchi in Safari, in basso 👇</p>
                  <p className="flex items-center gap-2 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">1</span>Tocca <Share className="inline size-4" /> <strong>Condividi</strong></p>
                  <p className="flex items-center gap-2 text-sm"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">2</span>Scorri e tocca <strong>“Aggiungi alla schermata Home”</strong></p>
                  <p className="text-xs leading-5 text-muted-foreground">Poi apri l’app <strong>{restaurant.shortName}</strong> dalla Home{authenticated ? "" : ", accedi"} e tocca <strong>“Attiva le notifiche”</strong>. Fatto.</p>
                </div>}
            <p className="text-center text-xs leading-5 text-muted-foreground">iPhone/iPad con iOS 16.4 o successivo. Apple non consente il download diretto: sulla schermata Home è comunque un’app a tutti gli effetti.</p>
          </>}

          {/* Non iPhone-da-installare: qui conta l'accesso (le notifiche hanno i
              dati dei clienti e si attivano solo da staff autenticato). */}
          {!(platform.ios && !standalone) && <>
            {!authenticated && <>
              <StatusCard tone="neutral" icon={<LogIn />} title="Accedi per attivare le notifiche" body={`Le notifiche contengono i dati dei clienti: puoi riceverle solo dopo esserti autenticato come staff di ${restaurant.shortName}.`} />
              <Button asChild size="lg" className="min-h-12 w-full text-base" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}><Link href={loginHref}>Accedi<ArrowRight /></Link></Button>
            </>}

            {authenticated && <>
              {staffName && <p className="text-center text-sm text-muted-foreground">Ciao {staffName.split(" ")[0]} — un ultimo passo.</p>}
              <Button onClick={() => void enable()} disabled={busy} size="lg" className="min-h-14 w-full text-base font-semibold" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>
                {busy ? <LoaderCircle className="animate-spin" /> : <BellRing />}
                {busy ? "Attivazione…" : "Attiva le notifiche"}
              </Button>
              {!standalone && !platform.ios && <p className="text-center text-xs leading-5 text-muted-foreground">Suggerimento: dal menu del browser puoi anche scegliere “Installa app” per tenerla a portata di mano.</p>}
            </>}
          </>}
        </>}
      </>}

      <div className="mt-2 rounded-2xl border bg-card/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Come funziona</p>
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
          <li>· Un cliente prenota → il telefono squilla, anche con l’app chiusa.</li>
          <li>· Tocca la notifica per aprire la prenotazione in agenda.</li>
          <li>· Vale solo per {restaurant.shortName}: le altre sedi non ti disturbano.</li>
        </ul>
      </div>
    </>}
  </main>;
}

function StatusCard({ tone, icon, title, body }: { tone: "success" | "warning" | "neutral"; icon: React.ReactNode; title: string; body: string }) {
  const toneClass = tone === "success"
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-700"
    : tone === "warning"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-700"
      : "border-border bg-card";
  return <div className={`flex items-start gap-3 rounded-2xl border p-4 ${toneClass}`}>
    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/60 [&_svg]:size-4">{icon}</span>
    <div className="min-w-0"><p className="font-semibold leading-tight text-foreground">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div>
  </div>;
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return <li className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--app-accent)", color: "var(--app-accent-fg)" }}>{n}</span>
    <span className="text-sm leading-6">{children}</span>
  </li>;
}
