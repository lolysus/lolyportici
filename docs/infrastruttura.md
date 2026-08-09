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
⚠️ **Vercel ha `DATABASE_URL` dal 09/08/2026, e gli serve.** Questa pagina affermava il contrario, e
il codice non lo rispettava: le pagine leggono i dati al momento del render con `getRepository()`,
che senza database ricade sul repository **in memoria**. In produzione ogni pagina del pannello
serviva quindi il set demo — misurato sulla pianta di Ardea: quindici tavoli "Tavolo 1…10" invece
dei trentasette reali `YI01–YE06`, senza nessun avviso che dicesse allo staff che stava leggendo
dati inventati.

Non era esploso perché tutto ciò che riguarda il cliente passa dalle API, dal browser, e arriva al
database vero: disponibilità, tavoli, blocco temporaneo, conferma, campanella. Era il pannello dello
staff a mentire — comprese le impostazioni che sembravano non salvarsi, perché il salvataggio andava
su Railway e il ridisegno veniva dalla memoria di Vercel.

Su Vercel il pool è di **tre** connessioni per istanza (`poolSize()` in `src/lib/postgres.ts`):
Railway è un processo che vive a lungo e dieci vanno bene, Vercel è tante istanze corte e dieci a
testa esaurirebbero le cinquecento connessioni del database a cinquanta istanze in parallelo.

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
| `DATABASE_URL` | ✅ | ✅ | su Vercel è l'URL **pubblico** del proxy: l'host interno non è raggiungibile |
| `MANAGEMENT_TOKEN_PEPPER` | — | ✅ | token di gestione prenotazione |
| `CRON_SECRET` | — | ✅ | protegge `/api/cron/*` |
| `APP_TIMEZONE`, `NEXT_PUBLIC_*` | — | ✅ | |
| `TRUSTED_ORIGINS` | — | ✅ | **deve elencare i domini reali**, vedi sotto |
| `ADMIN_ACCESS_PATHS` | ✅ | — | solo dove girano le pagine |
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

## Origini fidate: `curl` non basta a verificarle

`assertSameOrigin` protegge tutte le scritture (API di gestione, recupero password). Confronta
l'intestazione `Origin` con l'host della richiesta, l'`x-forwarded-host` e l'elenco in
`TRUSTED_ORIGINS`. Poiché le `/api/*` arrivano riscritte da Vercel verso Railway, **l'origine del
browser non coincide mai con l'host di Railway**: senza i domini reali nell'elenco, ogni scrittura
dai siti veri risponde `403 CSRF_CHECK_FAILED`.

È rimasto invisibile per giorni: `TRUSTED_ORIGINS` conteneva solo `lolyportici.vercel.app`, e ogni
verifica fatta con `curl` passava perché **senza intestazione `Origin` il controllo esce subito**.
Chi verifica questa strada deve mandarla a mano:

```bash
curl -s -X POST https://yukoardea.it/api/auth/password-reset \
  -H 'content-type: application/json' -H 'origin: https://yukoardea.it' \
  -d '{"email":"nessuno@example.it","scope":"yuko"}'
```

Atteso `"success":true`. Un `CSRF_CHECK_FAILED` significa che quel dominio manca dall'elenco. Provare
anche con un'origine inventata: lì il rifiuto è la risposta giusta.

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

## Backup e ripristino

Railway è sul piano Trial: **non ci sono backup automatici**. Prima di ogni migrazione va preso uno
snapshot a mano. `pg_dump` non è installato sulla macchina di sviluppo, quindi si usa la connessione
pubblica del servizio Postgres e si salvano le righe come JSON:

```bash
railway variables --service Postgres --kv | grep '^DATABASE_PUBLIC_URL='
```

Lo snapshot **non è un dump logico**: contiene le righe, non lo schema. Le funzioni, gli indici e le
policy vivono nelle migrazioni di questo repository e si ricostruiscono da lì; le righe no, ed è per
quelle che serve la copia. Contiene dati personali di clienti reali: resta in locale, fuori dal
repository, e non si condivide.

Rientro da un rilascio andato male:

1. **Codice** — `git revert <commit>` e ripubblicare (`git push` per Vercel, `railway up` per
   Railway). Le due piattaforme vanno riportate indietro entrambe, o restano disallineate.
2. **Migrazione** — quelle additive (colonne nuove, nullable) si annullano con `drop column` e non
   perdono nulla. Per una migrazione distruttiva non esiste rientro: il piano è lo snapshot di cui
   sopra, e va preso **prima**.

## Prenotazioni in diretta

La dashboard non interroga più il server ogni quindici secondi: **è il database ad avvisare**.

```text
  prenotazione confermata
          │
   trigger reservations_notify_change  →  pg_notify('reservation_changed')
          │
   hub in memoria (UN solo LISTEN per processo)  →  /api/admin/v1/stream (SSE)
          │
   dashboard della sola sede interessata
```

Misurato in produzione il 09/08/2026: **118 ms** fra la conferma e l'arrivo dell'evento, **231 ms**
fino all'avviso a schermo. Prima erano fino a 15 000 ms.

Tre scelte che sembrano dettagli e non lo sono:

- **Payload minuscolo.** `pg_notify` sopra gli 8000 byte *fa fallire la transazione*: mandare la
  prenotazione intera vorrebbe dire che una nota lunga del cliente fa fallire la prenotazione. Nel
  messaggio non c'è nemmeno il `reservation_code`, perché all'inserimento è ancora quello provvisorio
  (`MG-…`) e l'applicazione lo riscrive subito dopo. Chi ascolta rilegge dalle API.
- **Un `LISTEN` per processo, non per dashboard.** `sql.listen()` apre una connessione dedicata a
  ogni chiamata: dieci tablet avrebbero parcheggiato dieci connessioni ferme. L'hub in
  `src/lib/realtime/reservation-hub.ts` tiene una connessione e distribuisce in memoria, nasce col
  primo iscritto e chiude con l'ultimo.
- **L'interrogazione non è sparita.** Ogni due minuti mentre il flusso è vivo — un evento perso in
  una riconnessione non deve restare perso — e di nuovo ogni quindici secondi se il flusso cade.

La sede **non** arriva dal client: la decide il server dalla sessione. Verificato in produzione
creando una prenotazione di Ardea dalla dashboard di Portici: zero eventi, zero suoni, nessun avviso.

Diagnosi: `curl -N -H 'cookie: …' https://yukoardea.it/api/admin/v1/stream` deve rispondere
`event: ready` con `{"live":true,…}`. `live:false` significa che quel processo non ha il database e
la dashboard sta interrogando invece di ascoltare.
