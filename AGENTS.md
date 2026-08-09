# Loly — YUKO × KouSushi

Piattaforma prenotazioni per due ristoranti indipendenti sotto la stessa regia:
**YUKO** (Ardea, RM) e **KouSushi** (Portici, NA).

## Dove vive il progetto

| | |
| --- | --- |
| Repo | https://github.com/lolysus/lolyportici — branch `main` |
| Frontend | https://lolyportici.vercel.app — Vercel, team `loly5` |
| Backend API | https://loly-api-production.up.railway.app — Railway, servizio `loly-api` |
| Database | PostgreSQL 18 su Railway, regione Amsterdam |

**Dettagli completi, comandi e diagnosi: `docs/infrastruttura.md`. Leggilo prima di toccare la produzione.**

## Le tre cose che sorprendono chi arriva

1. **Un repo, due deploy.** Lo stesso codice Next.js gira su Vercel *e* su Railway.
   `next.config.ts` riscrive tutte le `/api/:path*` verso Railway, che è l'unico ad avere
   `DATABASE_URL` per le API — ma **anche Vercel ce l'ha**, perché le pagine leggono dati al render e
   senza database servirebbero il set demo (è già successo in produzione). **Solo Vercel si aggiorna dal push su `main`**
   (~45 secondi): Railway va pubblicato a mano con `railway up --service loly-api --detach` (~5
   minuti). Se lo dimentichi, il sito è aggiornato e le API no, senza nessun segnale.

2. **L'auth non è Supabase.** È nativa (`src/lib/auth/native.ts`): utenti in `AUTH_USERS_JSON`
   con hash scrypt, sessione in cookie firmato HMAC. `AUTH_USERS_JSON` e `AUTH_SESSION_SECRET`
   esistono sia su Vercel sia su Railway e **devono combaciare**, altrimenti il login si rompe in
   modo confuso.

3. **Il fallback demo è silenzioso.** Se `DATABASE_URL` manca, l'app non va in errore: serve dati
   finti in memoria (`src/repositories/index.ts`). Verifica sempre `"mode":"railway-postgres"` in
   `/api/health`.

## Documentazione superata

`docs/production-topology.md` e la sezione "Attivazione produzione" del `README.md` descrivono
la vecchia topologia con Supabase come fonte dati. Non seguirle: vale `docs/infrastruttura.md`.
Supabase resta nel codice solo come implementazione alternativa del repository, inattiva.

## Prima di ogni push

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Non ci sono backup automatici del database (richiedono Railway Pro, il piano è Trial).
Tratta ogni migrazione distruttiva come irreversibile.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
