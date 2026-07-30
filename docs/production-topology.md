# Topologia di produzione

> ⚠️ **DOCUMENTO SUPERATO — non seguire questa topologia.**
> Descrive l'assetto precedente, con Supabase come fonte dati unica e Railway come fase futura
> opzionale. Dal commit `b9384dc` la produzione usa **PostgreSQL su Railway**, e Vercel fa da
> frontend e proxy verso il backend Railway.
> La topologia valida è in **`docs/infrastruttura.md`**.
> Conservato come riferimento storico.

## Componenti

```text
Google / domini YUKO e KouSushi
                 |
              Vercel
     Next.js, pagine e Route Handler
                 |
             Supabase
 Postgres, Auth, RLS, RPC, Realtime, audit
                 |
        provider transazionali
      Resend, Telnyx, Retell, WhatsApp

Railway (fase successiva, opzionale)
worker persistenti, code e retry asincroni
```

## Responsabilità

- Vercel pubblica un solo artefatto applicativo dalla branch `main` di `lolysus/lolyportici`.
- Supabase è l'unica fonte dati. Le prenotazioni di YUKO e KouSushi condividono l'organizzazione, ma hanno `restaurant_id` e `location_id` distinti.
- Il CEO usa un ruolo centrale senza sede; gli operatori ricevono un ruolo limitato a un solo `location_id`.
- I due percorsi pubblici applicano brand e impostazioni diverse, ma attraversano lo stesso motore validato e transazionale.
- Railway non ospita un secondo database. Può essere aggiunto per processi sempre attivi, code, retry di notifiche o sincronizzazioni che non devono dipendere dalla durata di una funzione Vercel.

## Ambienti

| Ambiente | Branch | Database | Uso |
| --- | --- | --- | --- |
| Preview | pull request | progetto Supabase di staging | verifica prima della pubblicazione |
| Produzione | `main` | progetto Supabase di produzione | traffico reale e domini |

Non collegare preview e produzione allo stesso database. I secret vengono configurati nei rispettivi ambienti Vercel e non sono mai salvati nel repository.

## Domini

Il primo dominio può essere quello tecnico Vercel. In seguito si possono associare due domini o sottodomini allo stesso progetto:

- dominio YUKO → `/it/book/yuko`
- dominio KouSushi → `/it/book/kousushi`

Un redirect di ingresso deve conservare il ristorante scelto. Dashboard, API e URL di gestione non devono essere indicizzati.

## Railway

Prima di collegare Railway deve esistere un servizio concreto. La scelta consigliata è un worker notifiche che legge una coda, applica retry con backoff e registra l'esito in `notification_deliveries`. Il worker riceverà solo variabili server-side e non esporrà `SUPABASE_SERVICE_ROLE_KEY` al browser.

## Condizioni di rilascio

1. Pipeline GitHub verde su `main`.
2. Migrazioni applicate al progetto Supabase corretto dopo un backup.
3. `NEXT_PUBLIC_DEMO_MODE=false` e `/api/health` con `readiness=ready`.
4. Account CEO verificato su entrambe le sedi; account operatori verificati sulla propria sede.
5. Prenotazione reale di prova per YUKO e KouSushi, con notifica visiva e sonora.
6. Nessun URL o secret del precedente progetto Vercel presente nelle variabili o nei contenuti.
