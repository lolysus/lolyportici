# Architettura

## Struttura

Regia usa Next.js App Router. Le pagine Server Component leggono dati dal repository; i Client Component gestiscono wizard, filtri, drag and drop e aggiornamenti ottimistici. Le Route Handler espongono contratti JSON a booking, backoffice e assistente vocale.

```text
Browser / Retell / provider
            |
      Route Handler
            |
   validazione Zod + RBAC
            |
   ReservationRepository
       /            \
 memoria demo     Supabase
                      |
       Postgres, RLS, RPC, Realtime
```

Il dominio vive fuori dai componenti:

- `src/domains/availability`: calcolo slot e assegnazione tavoli.
- `src/domains/bookings`: errori e macchina a stati.
- `src/repositories`: interfaccia, memoria demo e Supabase.
- `src/integrations`: adapter Retell, Telnyx, Resend, WhatsApp e Google.
- `src/validators`: schemi dei confini HTTP.

## Flusso di prenotazione

1. Il client invia data, coperti, canale e preferenze a `/api/public/v1/availability`.
2. Il motore applica servizio, chiusure, durata, riassetto, capienza, picco arrivi e conflitti.
3. `/api/public/v1/holds` ricontrolla lo slot e riserva i tavoli per cinque minuti.
4. `/api/public/v1/reservations` conferma l'hold con una chiave di idempotenza.
5. Il repository crea o riusa il cliente normalizzato, genera il token di gestione e registra l'evento.
6. Email e SMS partono dopo la conferma. Un errore del provider non annulla la prenotazione.

In Supabase, `create_reservation_hold` e `confirm_reservation_from_hold` bloccano risorse e capacità con advisory lock. Modifica tramite token e riassegnazione amministrativa sono anch'esse RPC atomiche. `reservation_table_assignments` applica un vincolo GiST sulle fasce `[start_at, end_at)`. Due richieste concorrenti non possono occupare lo stesso tavolo nello stesso intervallo.

## Assegnazione tavoli

`findBestTableAssignment` scarta tavoli bloccati, occupati o troppo piccoli. Lo score premia la capienza vicina ai coperti e la sala richiesta; penalizza tavoli strategici sprecati e combinazioni non necessarie. Un requisito di accessibilità limita i candidati ai tavoli compatibili.

Il motore include il riassetto nell'intervallo occupato. Una prenotazione da 90 minuti con 15 minuti di riassetto blocca il tavolo per 105 minuti.

## Stato e audit

La macchina a stati consente solo passaggi operativi dichiarati, per esempio `confirmed -> arrived -> seated -> completed`. Il trigger SQL replica il controllo nel database. Ogni modifica crea un record in `reservation_events`; il trigger `reservations_audit` conserva prima e dopo in `audit_logs`.

Il token di gestione non viene salvato in chiaro. L'app conserva un hash SHA-256 con pepper e restituisce il token una sola volta. Il client lo usa nel percorso `/booking/manage/[token]`.

## Autenticazione e permessi

Supabase Auth gestisce la sessione. `staff_users`, `roles` e `staff_user_roles` collegano un utente alla sede. `requirePermission` ferma la pagina o la route prima della query. Le policy RLS restringono l'accesso all'organizzazione dell'utente.

Ruoli applicativi:

| Ruolo | Ambito |
| --- | --- |
| owner, administrator, manager | Gestione completa della sede |
| receptionist | Prenotazioni, sala in lettura, CRM |
| waiter | Stato sala e lettura ospiti |
| phone_operator | Prenotazioni, ospiti e chiamate |
| analyst | Analytics e prenotazioni in lettura |

La modalità demo crea una sessione manager solo quando `NEXT_PUBLIC_DEMO_MODE=true` o Supabase non è configurato. Imposta `NEXT_PUBLIC_DEMO_MODE=false` in produzione.

## Sicurezza dei confini

- Zod valida payload e limiti dimensionali.
- Le route pubbliche applicano rate limit per IP.
- Le mutazioni tramite token controllano l'origine della richiesta.
- Retell usa HMAC-SHA256 sul corpo grezzo e timestamp in millisecondi.
- Telnyx usa Ed25519 su `timestamp|payload`.
- Resend usa la busta Svix `id.timestamp.payload`.
- `webhook_events` deduplica i retry e conserva esito ed errore.
- Le note sensibili non possono avere visibilità cliente.

Il rate limiter demo usa memoria di processo. Per traffico distribuito, sposta i bucket su un archivio condiviso come Upstash Redis. Le prenotazioni restano protette dai vincoli Postgres anche senza quel cambio.
