# Piano di implementazione

## Obiettivo

Consegnare un verticale deployabile che unifica prenotazioni web, inserimenti operativi e chiamate AI sullo stesso motore di disponibilità e sullo stesso schema PostgreSQL multi-tenant.

## Architettura

- Next.js App Router con Server Components di default e isole client per wizard, grafici e drag-and-drop.
- Supabase PostgreSQL/Auth/Realtime/Storage; accesso privilegiato solo lato server e client inizializzati in modo lazy.
- Repository astratto: Supabase in produzione, archivio deterministico in memoria in modalità demo locale.
- Motore puro di disponibilità e assegnazione tavoli condiviso da API pubbliche, backend e tool vocali.
- Conferma atomica tramite funzione SQL con advisory lock, controllo hold e idempotency key.
- RBAC nel data access layer, nelle API e nelle policy RLS.

## Fasi

1. Completata — fondazioni, branding, i18n, design system, auth e configurazione.
2. Completata — schema, migrazioni, RLS, seed e repository.
3. Completata — disponibilità, hold, state machine, conferma/modifica/cancellazione.
4. Completata — booking pubblico e gestione tramite token.
5. Completata — dashboard, agenda, sala, CRM, attesa, chiamate, analytics, knowledge base, impostazioni e staff.
6. Completata — adapter Retell/Telnyx/Resend e webhook verificati/idempotenti.
7. Completata — test unitari, integrazione, E2E, accessibilità, lint, typecheck e build.

## Criteri di accettazione principali

- Due conferme concorrenti sull'ultima risorsa producono una sola prenotazione.
- Gli hold scaduti non bloccano disponibilità.
- Ogni mutazione registra un evento e non dipende dal successo della notifica.
- Le pagine amministrative verificano il ruolo vicino alla sorgente dati.
- Il progetto parte in demo senza credenziali esterne e passa a Supabase tramite variabili ambiente.
