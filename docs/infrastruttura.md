# Infrastruttura e deploy

Documento operativo unico: dove vive il progetto, come si aggiorna, come si verifica.
Se hai un solo file da leggere prima di toccare la produzione, è questo.

## Coordinate

| Cosa | Dove | Note |
| --- | --- | --- |
| Repository | https://github.com/lolysus/lolyportici | branch di produzione: `main` |
| Frontend | https://lolyportici.vercel.app | Vercel, team `loly5`, progetto `lolyportici` |
| Backend API | https://loly-api-production.up.railway.app | Railway, progetto `loly-production-backend`, servizio `loly-api` |
| Database | PostgreSQL 18 su Railway | servizio `Postgres`, volume `postgres-volume`, regione `europe-west4` (Amsterdam) |
| Health check | `/api/health` | risponde identico su entrambi i domini se il proxy è sano |

Dashboard: [Vercel](https://vercel.com/loly5/lolyportici) · [Railway](https://railway.com/project/388d9e3f-a31a-46f5-b7ca-3c27f08e1cff)

## Come è fatto: un repo, due deploy

Lo **stesso** codice Next.js gira in due posti diversi. Non esiste un backend separato.

```text
                    GitHub  lolysus/lolyportici  (main)
                       |                    |
                    Vercel               Railway
              pagine, login, UI        servizio loly-api
                       |                    |
                       └──  /api/*  ────────┤
                        (rewrite proxy)     |
                                         Postgres
```

`next.config.ts` riscrive tutte le richieste `/api/:path*` verso `BACKEND_ORIGIN`, cioè Railway.
Solo Railway possiede `DATABASE_URL`: **Vercel non parla mai direttamente col database.**

Conseguenza da tenere a mente: se il backend è giù, il sito si carica ma nessuna prenotazione funziona.
Il primo comando di diagnosi è sempre l'health check di Railway, non quello di Vercel.

## Aggiornare la produzione

**Vercel sì, Railway no.** Un push su `main` aggiorna Vercel in ~45 secondi. Railway **non parte
dal push**: va lanciato a mano.

```bash
git push origin main                      # aggiorna Vercel
railway up --service loly-api --detach    # aggiorna Railway
```

Verificato il 09/08/2026: `railway deployment list --service loly-api --json` mostra venti deploy e
**tutti** hanno `meta.cliCaller: "claude_code"`, nessuno viene da un commit. L'ultimo era del
06/08/2026 mentre `main` era già avanti. Questa pagina affermava il contrario e ha fatto aspettare
per dieci minuti un deploy che non era mai partito.

È lo stesso guasto silenzioso descritto più sotto a proposito di `watchPatterns`: il frontend si
aggiorna, le `/api/*` servono il codice vecchio, e nulla lo segnala. **Dopo ogni push, controlla che
il deploy Railway esista davvero** — non dare per scontato che il collegamento a GitHub funzioni.

Prima di ogni push:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Dopo il push, verifica che il backend sia risalito **prima** di considerare fatto il lavoro:

```bash
curl https://loly-api-production.up.railway.app/api/health
curl https://lolyportici.vercel.app/api/health
```

Attesa: `"readiness":"ready"`, `"mode":"railway-postgres"`, `"persistence":"durable"`.
Le due risposte devono coincidere. Se differiscono, il proxy o uno dei due deploy è in ritardo.

Railway impiega ~5 minuti (build completo con `npm ci`), Vercel ~45 secondi. È normale che per
qualche minuto il frontend sia già aggiornato e le API no.

⚠️ **Non usare `watchPatterns` in `railway.json`.** Sono stati provati il 30/07/2026 per saltare il
rebuild sui commit di sola documentazione: il risultato è stato che Railway ha smesso del tutto di
deployare, **senza segnalare nulla**. Vercel pubblicava il frontend, il backend restava al commit
precedente, e le `/api/*` continuavano a servire il codice vecchio. Il guasto è silenzioso e si
nota solo confrontando il commit del deploy Railway con `main`.

Se qualcuno vuole riprovarci, verifichi con `railway deployment list --service loly-api --json`
che dopo il push compaia un deployment con il `commitHash` giusto. Cinque minuti di build sprecati
valgono molto meno di un backend fermo di cui nessuno si accorge.

## Domini dedicati per ristorante

YUKO e KouSushi sono due attività separate. Su un dominio dedicato l'altra non
deve esistere: né link, né pagina raggiungibile.

La mappa dominio → ristorante sta in una sola variabile, su **Vercel** (è lì che
girano le pagine):

```
NEXT_PUBLIC_RESTAURANT_DOMAINS="yuko.it=yuko,www.yuko.it=yuko,kousushi.it=kousushi,www.kousushi.it=kousushi"
```

Ogni voce è `host=slug`. Gli slug validi sono quelli in `src/config/brand.ts`:
`yuko` e `kousushi`. Vanno elencati anche i `www.`, sono host diversi.

Con la variabile impostata, `src/proxy.ts` applica queste regole:

| Richiesta su `yuko.it` | Esito |
| --- | --- |
| `/` | redirect a `/it/book/yuko` |
| `/it/book` (scelta fra i due) | redirect a `/it/book/yuko` |
| `/it/book/yuko` | pagina del ristorante |
| `/it/book/kousushi` | **404** |

Le API restano fuori dal proxy: sono servite da Railway e non dipendono dal
dominio. Login e area amministrativa non vengono toccati.

**Se la variabile non è impostata il proxy non fa nulla** e l'applicazione serve
entrambi i ristoranti sotto lo stesso host, come su `lolyportici.vercel.app`.

Passi per collegare un dominio:

1. Aggiungi il dominio al progetto Vercel `loly5/lolyportici` e configura il DNS
   come indicato lì.
2. Aggiungi l'host alla variabile qui sopra, con e senza `www`.
3. Ridistribuisci il frontend, poi verifica che `https://dominio/` porti alla
   pagina giusta e che l'altro ristorante risponda 404.

Aggiorna anche `NEXT_PUBLIC_APP_URL` se il dominio principale cambia: alimenta
i link canonici e i dati strutturati.

## Migrazioni database

`railway.json` esegue `npm run db:railway:migrate` come `preDeployCommand`: **le migrazioni
partono da sole a ogni deploy**, prima che il nuovo codice riceva traffico. Se una migrazione
fallisce il deploy si ferma e la versione precedente resta in servizio.

Le migrazioni vivono in `supabase/migrations/` (nome storico) e sono applicate a PostgreSQL su
Railway da `scripts/migrate-railway.mjs`.

⚠️ I backup automatici richiedono Railway Pro. Sul piano Trial attuale **non ci sono backup**.
Finché resta così, tratta ogni migrazione distruttiva come irreversibile.

## Variabili d'ambiente

Non stanno nel repository. Vivono nelle due piattaforme e vanno tenute coerenti.

| Variabile | Vercel | Railway | Nota |
| --- | :---: | :---: | --- |
| `AUTH_USERS_JSON` | ✅ | ✅ | **deve combaciare nei due posti** |
| `AUTH_SESSION_SECRET` | ✅ | ✅ | **deve combaciare nei due posti** |
| `BACKEND_ORIGIN` | ✅ | — | punta a Railway |
| `DATABASE_URL` | — | ✅ | solo backend |
| `MANAGEMENT_TOKEN_PEPPER` | — | ✅ | token di gestione prenotazione |
| `CRON_SECRET` | — | ✅ | protegge `/api/cron/*` |
| `TRUSTED_ORIGINS`, `APP_TIMEZONE`, `NEXT_PUBLIC_*` | — | ✅ | |
| `RESEND_API_KEY` | — | ✅ | l'invio parte dall'API, non dalle pagine |
| `EMAIL_FROM_BY_LOCATION` | — | ✅ | un mittente per sede |
| `EMAIL_FROM` | — | ✅ | rete di sicurezza per una sede non elencata |
| `GUEST_CONFIRMATION_EMAIL` | — | ✅ | `off`: Resend serve solo il recupero password |

`AUTH_USERS_JSON` e `AUTH_SESSION_SECRET` sono duplicati perché il login gira su Vercel mentre le
API girano su Railway: entrambi devono firmare e verificare la stessa sessione. **Se ne aggiorni
uno solo, il login si rompe in modo confuso** — accesso apparentemente riuscito, poi API che
rispondono come se non fossi autenticato.

Ispezione (mostra i nomi, non i valori):

```bash
vercel env ls production
railway variables --service loly-api
```

## Autenticazione staff

Non è Supabase Auth. È l'implementazione nativa in `src/lib/auth/native.ts`: gli utenti sono un
array JSON dentro `AUTH_USERS_JSON`, con password in scrypt (`passwordSalt` + `passwordHash`), e
la sessione è un cookie `loly_staff_session` firmato HMAC-SHA256, valido 8 ore.

Dalla migrazione `0012` esiste anche la tabella `staff_accounts`, e **viene letta prima** della
variabile: chi ha reimpostato la password vive lì. La variabile resta la rete di sicurezza per chi
non è ancora passato dal recupero. Ruotare a mano una password di chi sta ancora nella variabile
significa rigenerare hash e salt e aggiornarla **su entrambe le piattaforme**.

Due trappole viste dal vero:

- **Niente BOM nel valore.** Un `AUTH_USERS_JSON` incollato da un file salvato su Windows inizia
  con un BOM invisibile. `JSON.parse` lo rifiutava e l'elenco restava vuoto in silenzio: nessuno
  poteva accedere e il recupero password non trovava mai un account. Ora `users()` fa `trim()` e
  scrive l'errore nei log, ma il valore va scritto pulito comunque.
- **L'email dell'account è l'indirizzo del recupero.** Il link parte verso l'email con cui si
  entra: se lì c'è un indirizzo di comodo tipo `@loly.local`, il recupero non raggiunge nessuno e
  non segnala niente. Ogni sede vuole una casella vera.

## Email in uscita

L'invio passa da Resend e **parte da Railway**, non da Vercel: le pagine non hanno la chiave.

**Una chiave sola, due usi da non confondere.** Oggi Resend serve **solo il recupero password dello
staff**. Le conferme di prenotazione al cliente sono spente da `GUEST_CONFIRMATION_EMAIL=off`,
scelta esplicita del 09/08/2026: la chiave è condivisa, quindi configurarla per il recupero password
aveva acceso di rimbalzo anche le email ai clienti, che nessuno aveva chiesto.

L'interruttore è separato da `notifications.emailConfirmationEnabled` di proposito. Quella è una
preferenza del ristoratore — vive fra le impostazioni della sede, in `booking_rules.conditions`, ed è
attiva per default. Questa è una decisione di chi gestisce la piattaforma, e deve poter valere
**sopra** la preferenza del ristorante.

Per riaccenderle serve mettere `on` — e prima conviene verificare `kousushiportici.it`, altrimenti i
clienti di Portici ricevono la conferma da un dominio di Ardea.

Il mittente dipende dalla sede, perché YUKO e KouSushi sono due attività con due domini: una
conferma per Portici che arriva da `@yukoardea.it` sembra un raggiro.

```
EMAIL_FROM_BY_LOCATION="yuko=noreply@yukoardea.it,kousushi=noreply@kousushiportici.it"
```

**Il dominio del mittente va verificato su resend.com/domains** (record SPF e DKIM nel DNS, che per
questi due domini è su GoDaddy). Senza verifica Resend rifiuta l'invio con `403` e accetta come
destinatario solo l'email del titolare dell'account Resend. Il guasto è invisibile dall'esterno:
la richiesta di recupero risponde correttamente e l'email non parte.

Stato per sede, da `/api/health`:

```bash
curl -s https://loly-api-production.up.railway.app/api/health | grep -o '"emailSenders".*'
```

⚠️ Lì `"ready"` significa **"chiave e mittente configurati"**, non "dominio verificato": la verifica
vive su Resend e con una chiave solo-invio non è interrogabile. Con il dominio non verificato il
health check dice `ready` e l'invio fallisce comunque. La prova sta nei log:

```bash
railway logs --service loly-api | grep -i resend
```

Un `403 ... domain is not verified` lì significa che manca il DNS, non che l'app sia rotta.

## Accessi

| Servizio | Account | Verifica |
| --- | --- | --- |
| GitHub | `lorenzotett` (push su `lolysus/lolyportici`) | `gh auth status` |
| Vercel | `suhsiportici-7247`, team `loly5` | `vercel whoami` |
| Railway | `suhsiportici@outlook.it`, workspace `lolysus's Projects` | `railway whoami` |

Se una CLI si scollega:

```bash
vercel login
vercel link --yes --scope loly5 --project lolyportici

railway login
railway link --project 388d9e3f-a31a-46f5-b7ca-3c27f08e1cff --environment production --service loly-api
```

## Diagnosi rapida

```bash
railway logs --service loly-api          # log runtime del backend
railway service list --json              # stato deploy, repliche, volumi
vercel ls --prod                         # ultimi deploy frontend
gh api repos/lolysus/lolyportici/deployments --jq '.[0]'
```

| Sintomo | Causa probabile |
| --- | --- |
| Sito ok, prenotazioni no | backend Railway giù o in deploy — controlla il suo `/api/health` |
| Login accettato ma API non autenticate | `AUTH_SESSION_SECRET` diverso tra Vercel e Railway |
| `mode` diverso da `railway-postgres` | `DATABASE_URL` mancante: l'app è caduta in demo in-memory |
| Modifica senza effetto sulle API | deploy Railway ancora in corso (~5 min) o fallito |

Il fallback silenzioso in modalità demo è il rischio più insidioso: l'app **non** va in errore se
`DATABASE_URL` manca, si limita a servire dati finti. Il campo `mode` dell'health check è il modo
per accorgersene.

## Documenti correlati

- `docs/architecture.md` — componenti, flusso booking, invarianti
- `docs/database.md` — schema, migrazioni, RLS, audit
- `docs/permissions.md` — matrice ruoli
- `docs/verifica-preventivo.md` — conformità al preventivo e dipendenze ancora esterne

⚠️ `docs/production-topology.md` e la sezione "Attivazione produzione" del README descrivono la
topologia **precedente**, basata su Supabase come fonte dati. Sono superati da questo documento.
