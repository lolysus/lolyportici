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

Entrambe le piattaforme sono collegate a GitHub. **Un push su `main` aggiorna tutto**, in parallelo.

```bash
git push origin main
```

Non serve `vercel --prod` né `railway up`. Erano necessari prima del 30/07/2026, quando Railway
veniva aggiornato a mano via CLI e poteva restare indietro rispetto a Vercel — con il sintomo
ingannevole di un sito aggiornato che però si comporta come prima.

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

I `watchPatterns` in `railway.json` fanno saltare il rebuild del backend quando un commit tocca
**solo** documentazione (`*.md` in radice e `docs/**`). Qualsiasi modifica al codice lo fa partire
normalmente. Sono pattern in stile gitignore, e la negazione funziona solo dopo una regola che
include: per questo la lista comincia da `**`. Se aggiungi esclusioni, ricordati che un pattern
troppo largo blocca in silenzio tutti i deploy del backend — l'esatto guasto che questa
configurazione serve a evitare.

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

Ruotare una password significa **rigenerare hash e salt e aggiornare la variabile su entrambe le
piattaforme**. Non c'è nessuna tabella utenti da modificare e nessuna schermata di cambio password
per questi account.

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
