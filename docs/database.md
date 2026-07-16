# Database

Lo schema PostgreSQL è multi-tenant: `organization_id`, `restaurant_id` e `location_id` separano i dati ai livelli appropriati. Gli identificativi sono UUID, gli orari operativi sono `timestamptz` e la timezone della sede determina date e fasce locali.

## Aree dello schema

| Area | Tabelle principali |
| --- | --- |
| Organizzazione | `organizations`, `restaurants`, `locations` |
| Sala | `dining_areas`, `restaurant_tables`, `table_combinations`, `table_combination_items` |
| Regole | `service_periods`, `special_openings_closures`, `booking_rules` |
| Prenotazioni | `reservations`, `reservation_table_assignments`, `reservation_notes`, `reservation_events`, `reservation_holds` |
| Ospiti | `customers`, `customer_preferences`, `waitlist_entries` |
| Personale | `staff_users`, `roles`, `staff_user_roles` |
| Canali | `voice_calls`, `notifications`, `knowledge_base` |
| Controllo | `audit_logs`, `webhook_events`, `idempotency_keys` |

`reservation_table_assignments` usa un vincolo di esclusione GiST sulla coppia tavolo/intervallo. Due assegnazioni attive non possono sovrapporsi. Le cancellazioni disattivano l'assegnazione senza perdere lo storico.

## Migrazioni

1. `0001_core_schema.sql`: estensioni, tabelle, foreign key, check, trigger `updated_at` e vincolo anti-overlap.
2. `0002_security_and_booking_functions.sql`: RLS, policy per organizzazione/sede, macchina a stati SQL, conferma da hold, scadenza hold e controllo delle note sensibili.
3. `0003_indexes_realtime_audit.sql`: indici operativi, audit delle prenotazioni, replica identity e pubblicazione Realtime.
4. `0004_atomic_hold_and_modification.sql`: creazione hold, modifica cliente e riassegnazione tavoli atomiche; lock ordinati su tavoli/servizio, regole di anticipo, chiusure e limiti di capacità.

Le RPC critiche sono `security definer`, hanno un `search_path` esplicito e sono eseguibili solo dal `service_role`. Le Route Handler le chiamano lato server; il browser non riceve mai la chiave privilegiata.

## RLS e audit

Le migrazioni successive completano il modello operativo: `0005` riconcilia ritardi/no-show e gruppi numerosi, `0006` rende atomici ruolo, stato e assegnazione del personale, mentre `0007_location_access_boundaries.sql` separa prenotazioni, ospiti, eventi e notifiche per sede. Solo i ruoli `owner` e `administrator`, o un'assegnazione esplicitamente centrale senza sede, possono accedere a entrambe.

Le policy derivano le organizzazioni accessibili da `staff_users` e `staff_user_roles`. Le entità di sede passano da `can_access_location`. La knowledge base espone in lettura anonima solo righe pubbliche e attive.

Ogni mutazione di `reservations` crea un audit con valori precedenti e nuovi. `reservation_events` conserva gli eventi di dominio leggibili dall'agenda. `webhook_events` registra claim, elaborazione ed errori per rendere idempotenti i retry dei provider.

## Seed e manutenzione

`supabase/seed.sql` crea una sola organizzazione con due ristoranti indipendenti, Centro e Mare, ciascuno con sale, tavoli, servizi, regole e knowledge base propri. `0008_split_managed_restaurants.sql` migra la seconda entità sul suo `restaurant_id`. `npm run db:seed` esegue un reset locale: non va usato su un database con dati reali.

Gli hold scaduti non partecipano alla disponibilità. La funzione `expire_reservation_holds()` può essere richiamata da Supabase Cron; anche senza il job, tutte le query operative filtrano `expires_at > now()`.
