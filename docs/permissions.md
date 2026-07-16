# Permessi

## Ambito sede e regia centrale

`owner` e `administrator` sono ruoli centrali e possono operare su entrambe le sedi. Gli altri ruoli sono limitati ai `location_id` presenti nelle loro assegnazioni; il cookie del selettore non amplia mai questo elenco. Inviti e modifiche del personale usano la sede attiva, mentre la matrice globale dei permessi può essere modificata soltanto dalla regia centrale.

Supabase Auth identifica l'utente. `staff_users` lo collega all'organizzazione e alla sede; `staff_user_roles` assegna il ruolo. Il data access layer esegue `requirePermission` prima delle query e delle mutazioni, mentre RLS limita comunque le righe accessibili.

| Ruolo | Prenotazioni | Sala | Ospiti | Chiamate | Analytics | Knowledge | Impostazioni | Staff |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner | lettura/scrittura | lettura/scrittura | lettura/scrittura | lettura | lettura | scrittura | scrittura | scrittura |
| administrator | lettura/scrittura | lettura/scrittura | lettura/scrittura | lettura | lettura | scrittura | scrittura | scrittura |
| manager | lettura/scrittura | lettura/scrittura | lettura/scrittura | lettura | lettura | scrittura | scrittura | scrittura |
| receptionist | lettura/scrittura | lettura | lettura/scrittura | — | — | — | — | — |
| waiter | lettura | lettura/scrittura | lettura | — | — | — | — | — |
| phone_operator | lettura/scrittura | — | lettura | lettura | — | — | — | — |
| analyst | lettura | — | — | — | lettura | — | — | — |

La matrice applicativa è in `src/config/permissions.ts`. Le route mutative eseguono anche il controllo same-origin. I token di gestione cliente sono casuali, restituiti una sola volta e archiviati solo come hash con pepper.

## Primo amministratore

1. crea l'utente in Supabase Auth;
2. inserisci la riga in `staff_users` con l'UUID Auth;
3. assegna il ruolo `owner` in `staff_user_roles`;
4. verifica accesso e isolamento RLS con un secondo utente senza ruolo.

Le query complete sono in `docs/deployment.md`. In modalità demo viene usata una sessione manager fittizia; questa modalità deve essere disattivata in produzione.
