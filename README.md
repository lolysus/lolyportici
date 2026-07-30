# Loly Portici — Regia Sushi YUKO × KouSushi

Regia Ristoranti riunisce prenotazioni web e telefoniche, sala, lista d'attesa, CRM, chiamate AI e report di due ristoranti indipendenti in un'app Next.js. Il repository parte in modalità demo senza servizi esterni. Collegando Supabase e i provider elencati in `.env.example`, gli stessi flussi usano dati persistenti e notifiche reali.

## Stack

Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS, shadcn/Radix, Zod, React Hook Form, TanStack Table, Recharts e dnd-kit. I dati di produzione usano Supabase PostgreSQL, Auth, RLS e Realtime. Vitest copre dominio e API; Playwright verifica i flussi Chromium.

## Avvio locale

Requisiti: Node.js 22 o 24 e npm 10 o successivo.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Apri `http://localhost:3000`. La home reindirizza alla scelta pubblica del ristorante in italiano.

- Scelta ristorante: `http://localhost:3000/it/book`
- Booking YUKO (Ardea): `http://localhost:3000/it/book/yuko`
- Booking KouSushi (Portici): `http://localhost:3000/it/book/kousushi`
- Area ospite: `http://localhost:3000/account`
- Backoffice: `http://localhost:3000/admin/dashboard`
- Regole master: `http://localhost:3000/admin/master`
- Login: `http://localhost:3000/login`
- Health check: `http://localhost:3000/api/health`

Con `NEXT_PUBLIC_DEMO_MODE=true`, il backoffice usa una sessione manager dimostrativa. Nomi, telefoni e chiamate demo riportano etichette riconoscibili. Sito, telefoni, indirizzi, email, testi legali e policy presenti in `src/config/brand.ts` sono dati di configurazione iniziali: devono essere confermati dal titolare prima di trattare dati reali.

## Variabili ambiente

| Gruppo | Variabili |
| --- | --- |
| App | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEMO_MODE`, `APP_TIMEZONE`, `MANAGEMENT_TOKEN_PEPPER` |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Retell | `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_WEBHOOK_SECRET` |
| Telnyx | `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_MESSAGING_PROFILE_ID`, `TELNYX_FROM_NUMBER` |
| Resend | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM` |
| Opzionali | variabili WhatsApp e Google Calendar presenti in `.env.example` |

Le chiavi mancanti mantengono gli adapter in sandbox. In produzione imposta `NEXT_PUBLIC_DEMO_MODE=false` e non usare mai il prefisso `NEXT_PUBLIC_` per service role o secret.

## Funzioni incluse

- Booking responsive in italiano, inglese e spagnolo con disponibilità, hold da cinque minuti, conferma idempotente, gestione tramite token e lista d'attesa.
- Pagine di prenotazione veloci e mobile-first, con barra di avanzamento, azioni sicure nell'area del pollice, Google Maps, Google Calendar, `robots.txt`, sitemap e dati strutturati per ciascun ristorante.
- Motore tavoli con durate per coperti, riassetto, preferenze di sala, tavoli combinabili, chiusure, tetto coperti e limite arrivi per slot.
- Agenda e timeline operative, planimetria drag and drop, stati di servizio, waitlist, CRM, registro chiamate, analytics CSV, knowledge base, ruoli e integrazioni.
- Supabase Postgres con RLS, audit log, Realtime, vincolo anti-overlap e RPC atomiche per hold, conferma, modifica e riassegnazione.
- Impostazioni operative separate per ristorante: modalità live/approvazione/pausa, settimana pranzo-cena, capacità, ritmo arrivi, soglie di attenzione, policy ospite, canali di conferma e comportamento AI.
- Centro notifiche per ristorante con avviso in-app, segnale sonoro, Realtime e controllo periodico di sicurezza.
- Autorizzazioni per ristorante applicate a sessione, API, repository e policy RLS; regia centrale con flusso unificato.
- Tool HTTP per Retell, SMS Telnyx, email Resend, WhatsApp e Google Calendar. Gli adapter senza credenziali restituiscono stato sandbox.
- Firma webhook Retell HMAC-SHA256, Telnyx Ed25519 e Resend Svix, con finestra anti-replay e deduplicazione persistente.

## Comandi

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run test:e2e
npm run build
```

## Attivazione produzione

1. Crea un progetto Supabase e copia `.env.example` in `.env.local`.
2. Collega il progetto con `npx supabase link --project-ref <PROJECT_REF>`.
3. Esegui `npm run db:migrate`. Per caricare i dati demo locali usa `npm run db:seed`.
4. Crea il primo utente in Supabase Auth e assegnagli un ruolo con le query in `docs/deployment.md`.
5. Inserisci le stesse variabili nel progetto Vercel, poi esegui `vercel --prod`.
6. Configura i webhook dei provider dopo che il dominio HTTPS risponde su `/api/health`.

La topologia consigliata è Vercel per l'applicazione e le Route Handler, Supabase per Postgres/Auth/RLS/Realtime e Railway, in una fase successiva, soltanto per worker persistenti e retry asincroni. Vedi `docs/production-topology.md`.

Il seed contiene solo dati fittizi. Non usarlo in un database che contiene prenotazioni reali.

## Configurazione multi-ristorante

L'account master accede a `Ristoranti` e `Regole master`: confronta saturazione, stato operativo e attenzioni di YUKO e KouSushi, quindi applica policy condivise con un unico salvataggio. Il selettore nella barra superiore cambia il contesto attivo; agenda, sala, attesa, chiamate, analytics e configurazioni restano isolate per ristorante. Gli operatori di sede vedono invece solo il proprio ristorante e non possono accedere alle regole centrali.

In `Impostazioni` ogni ristorante può essere:

- `Operativa`: booking web e voce confermano secondo disponibilità e regole.
- `Solo richieste`: le richieste passano allo staff senza conferma automatica.
- `In pausa`: nuovi booking web e voce vengono sospesi, mantenendo intatta la configurazione.

Gli orari settimanali alimentano realmente il motore di disponibilità. I testi di arrivo compaiono nel booking pubblico e nelle informazioni della voce AI; email, SMS e avvisi staff rispettano gli interruttori del ristorante selezionato.

## Provider

- Retell: crea l'agente, imposta i tool su `/api/voice/tools/[tool]`, aggiungi `locationId` e registra `/api/webhooks/retell`.
- Telnyx: configura numero/profilo, chiave pubblica Ed25519 e webhook `/api/webhooks/telnyx`.
- Resend: verifica dominio e mittente, quindi registra `/api/webhooks/resend` con il relativo signing secret.

Prompt, payload, escalation e test sandbox sono descritti in `docs/voice-agent.md`.

## Troubleshooting

- Nessun dato persistente: controlla che demo mode sia `false` e che tutte e tre le variabili Supabase siano presenti.
- Nessuno slot: verifica servizio, preavviso minimo, finestra massima, chiusure, coperti e tavoli attivi.
- Webhook rifiutato: controlla header di firma, secret/chiave pubblica e orologio del server.
- Migrazioni locali non avviate: Supabase CLI richiede un runtime Docker attivo per `db reset` e `db lint --local`.

## Documentazione

- `docs/architecture.md`: componenti, flusso booking, invarianti e sicurezza.
- `docs/database.md`: schema, migrazioni, RLS, audit e seed.
- `docs/booking-engine.md`: regole, assegnazione, concorrenza e timezone.
- `docs/permissions.md`: matrice ruoli e procedura di accesso.
- `docs/api.md`: endpoint pubblici, amministrativi, vocali ed errori.
- `docs/voice-agent.md`: configurazione Retell, Telnyx e regole dell'assistente.
- `docs/deployment.md`: Supabase, primo amministratore, Vercel e checklist di rilascio.
- `docs/production-topology.md`: confini tra Vercel, Supabase, Railway, ambienti e domini.
- `docs/implementation-plan.md`: mappa delle fasi implementate.
- `docs/verifica-preventivo.md`: matrice di conformità rispetto al preventivo e dipendenze ancora esterne.
- `docs/manuale-operativo.md`: formazione base e procedure quotidiane per il personale.

## Scelte dati

Le route e i componenti dipendono dall'interfaccia `ReservationRepository`. `MemoryReservationRepository` rende l'app esplorabile senza account; `SupabaseReservationRepository` entra in uso quando le chiavi Supabase sono presenti e la modalità demo è disattivata. Nessuna UI simula una conferma: il client crea sempre un hold e chiama l'endpoint di conferma.

La timezone del locale è `Europe/Rome`. Le API scambiano timestamp ISO; il database conserva `timestamptz`. Prima del lancio, verifica orari legali, policy, privacy, allergeni e testi pubblici con il ristorante.
