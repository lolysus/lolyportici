# Assistente vocale

## Configurazione Retell

1. Crea un agente multilingua con italiano come lingua primaria.
2. Imposta `RETELL_API_KEY` e `RETELL_AGENT_ID` nel progetto Vercel.
3. Registra `https://<dominio>/api/webhooks/retell` come webhook dell'agente.
4. Crea i custom tool elencati in `docs/api.md`. Ogni tool usa `POST https://<dominio>/api/voice/tools/<nome>`.
5. Aggiungi `locationId` con il valore della sede e una `sessionId` univoca per chiamata.
6. Usa lo stesso API key con badge webhook per la verifica di `x-retell-signature`.

Quando un amministratore salva la sezione **AI telefonica**, Regia aggiorna il prompt e l'elenco dei tool dell'agente Retell configurato. Senza credenziali Retell le policy restano comunque applicate alle API vocali e la UI segnala lo stato sandbox.

Il prompt dell'agente deve contenere queste regole:

- Leggi orari, indirizzo, accessibilità e allergeni dal tool `restaurant-information` o dalla knowledge base attiva.
- Non inventare informazioni mancanti. Crea una richiesta di richiamata.
- Esegui `check-availability` prima di proporre un orario.
- Esegui `create-hold` dopo la scelta dell'ospite.
- Raccogli nome, cognome, telefono, lingua e consenso privacy prima di `confirm-reservation`.
- Ripeti data, ora, coperti e codice di conferma.
- Trasferisci al personale gruppi oltre dieci persone, eventi privati, reclami, allergie gravi o richieste incerte.
- Non leggere note interne, rischio no-show o dati di altri clienti.

## Telefonia Telnyx

1. Crea un Messaging Profile e assegna un numero E.164.
2. Copia API key, profile ID, numero mittente e public key in `TELNYX_*`.
3. Imposta il webhook del profilo su `https://<dominio>/api/webhooks/telnyx`, versione API 2.
4. Invia un SMS di test dall'adapter e controlla `notifications` e `webhook_events`.

La verifica Ed25519 accetta public key Telnyx in base64 o esadecimale. Il server scarta timestamp più vecchi di cinque minuti.

## Email Resend

1. Verifica il dominio mittente.
2. Imposta `RESEND_API_KEY`, `EMAIL_FROM` e `RESEND_WEBHOOK_SECRET`.
3. Registra `https://<dominio>/api/webhooks/resend` per eventi sent, delivered, bounced e complained.
4. Prova una conferma con un indirizzo interno prima di aprire il booking pubblico.

## Test operativo

Esegui almeno queste chiamate in staging:

| Scenario | Esito atteso |
| --- | --- |
| Tavolo disponibile | Hold, conferma, codice e SMS |
| Ultimo tavolo conteso | Una conferma e un'alternativa |
| Gruppo da 11 | Richiamata al manager |
| Orario chiuso | Nessuna promessa, proposta alternativa |
| Allergia grave | Nota e trasferimento umano |
| Cliente cerca una prenotazione | Ricerca con telefono e codice |
| Firma webhook errata | HTTP 401, nessuna scrittura |

Conserva registrazioni e trascrizioni solo dopo aver definito base giuridica, informativa e durata di conservazione con il titolare.
