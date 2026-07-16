# Deploy Supabase e Vercel

## 1. Dati del ristorante

Verifica con il titolare i dati pubblici in `src/config/brand.ts`: nome legale, telefono, email, indirizzi dei due ristoranti, sito, orari, policy di cancellazione e testi privacy. Il logo applicativo si trova in `public/sushi-logo.svg`.

## 2. Supabase

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npm run db:migrate
```

`db:migrate` applica le migrazioni senza caricare il seed. `npm run db:seed` resetta il database locale e inserisce dati fittizi; non eseguirlo sul progetto di produzione.

Abilita Email Auth nel dashboard Supabase. Crea il primo utente, copia il suo UUID da Authentication > Users ed esegui nel SQL Editor:

```sql
insert into public.staff_users (
  organization_id, default_location_id, auth_user_id,
  first_name, last_name, email, status
)
select
  o.id, l.id, '<AUTH_USER_UUID>'::uuid,
  'Nome', 'Cognome', 'admin@example.com', 'active'
from public.organizations o
join public.restaurants r on r.organization_id = o.id
join public.locations l on l.restaurant_id = r.id
where r.slug = 'ristorante-sushi-centro'
on conflict (auth_user_id) do update
set status = 'active', updated_at = now();

insert into public.staff_user_roles (staff_user_id, role_id, location_id)
select su.id, ro.id, su.default_location_id
from public.staff_users su
cross join public.roles ro
where su.auth_user_id = '<AUTH_USER_UUID>'::uuid
  and ro.name = 'owner'
on conflict do nothing;
```

## 3. Variabili Vercel

Imposta almeno:

```text
NEXT_PUBLIC_APP_URL=https://prenota.example.com
NEXT_PUBLIC_DEMO_MODE=false
APP_TIMEZONE=Europe/Rome
MANAGEMENT_TOKEN_PEPPER=<32 BYTE CASUALI>
NEXT_PUBLIC_SUPABASE_URL=<URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE ROLE KEY>
```

Genera il pepper con `openssl rand -base64 32`. Non esporre service role, API key o secret in variabili `NEXT_PUBLIC_*`.

Aggiungi le variabili dei provider da `.env.example`. Imposta `DEFAULT_LOCATION_ID` sul ristorante predefinito; il pannello consente poi di passare tra i due ristoranti mantenendo dati e configurazioni separati.

## 4. Deploy

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx vercel --prod
```

Controlla `https://<dominio>/api/health`, poi registra i webhook descritti in `docs/voice-agent.md`. I provider richiedono HTTPS.

## 5. Google: schede dei ristoranti e indicizzazione

1. Imposta `NEXT_PUBLIC_APP_URL` sul dominio pubblico definitivo: è usato per canonical URL, sitemap e link copiati dal pannello.
2. In `Backoffice > Integrazioni`, copia il link diretto di ciascun ristorante contrassegnato `Google` e inseriscilo nel campo di prenotazione della relativa scheda Google Business Profile. Non usare il selettore generale per una scheda di un singolo ristorante.
3. In Google Search Console invia `https://<dominio>/sitemap.xml`. Il file `robots.txt` lascia indicizzabili le pagine pubbliche e esclude backoffice, API e gestione privata delle prenotazioni.
4. Il sito espone dati strutturati `Restaurant` e `ReserveAction` e apre Google Maps/Google Calendar per il cliente. Il badge nativo “Prenota con Google” richiede invece un partner di prenotazione idoneo o l'abilitazione da parte di Google: non viene attivato automaticamente da un semplice link.

## 6. Checklist di rilascio

- RLS limita il personale operativo al ristorante assegnato e consente entrambi i ristoranti solo alla regia centrale.
- Un account di ristorante non può cambiare cookie o chiamare API per leggere prenotazioni dell'altro ristorante.
- Il centro notifiche rileva una nuova prenotazione e il segnale sonoro funziona dopo l'attivazione sul dispositivo.

- `NEXT_PUBLIC_DEMO_MODE` vale `false`.
- Il database di produzione non contiene nomi con `(Demo)` o numeri `+390000000...`.
- RLS blocca un utente senza ruolo; i test verificano sia il confine di organizzazione sia quello di ristorante.
- Due richieste concorrenti sull'ultimo tavolo producono una sola prenotazione.
- Il link di gestione apre, modifica e cancella la prenotazione prevista.
- Retell, Telnyx e Resend rifiutano una firma alterata.
- Email e SMS usano mittenti verificati e testi approvati.
- Il titolare ha approvato conservazione dati, consensi, allergeni e procedura no-show.
- Desktop e mobile completano il booking con tastiera e touch.
- Il team sa disattivare booking online e AI vocale dalle impostazioni del servizio.

## Ripristino

Le migrazioni sono additive. Prima di una modifica distruttiva, crea un backup Supabase e prova la query in staging. Per un rollback applicativo, promuovi il deployment Vercel precedente; non cancellare righe di prenotazione. Usa `deleted_at` o una transizione di stato per conservare l'audit.
