# API

Le risposte di successo usano `{ "success": true, "data": ... }`. Gli errori usano `{ "success": false, "error": { "code", "message", "details" } }`.

## Booking pubblico

| Metodo | Percorso | Scopo |
| --- | --- | --- |
| POST | `/api/public/v1/availability` | Slot e alternative |
| POST | `/api/public/v1/holds` | Hold temporaneo |
| DELETE | `/api/public/v1/holds` | Rilascio hold |
| POST | `/api/public/v1/reservations` | Conferma idempotente |
| GET | `/api/public/v1/reservations/manage/[token]` | Lettura prenotazione |
| PATCH | `/api/public/v1/reservations/manage/[token]` | Cambio orario, coperti o note |
| DELETE | `/api/public/v1/reservations/manage/[token]` | Cancellazione cliente |
| POST | `/api/public/v1/waitlist` | Ingresso in lista d'attesa |

Esempio disponibilità:

```json
{
  "locationId": "00000000-0000-0000-0000-000000000003",
  "date": "2031-05-20",
  "requestedTime": "20:00",
  "partySize": 4,
  "source": "web",
  "accessibilityRequirements": false
}
```

Esempio conferma:

```json
{
  "holdId": "<UUID HOLD>",
  "idempotencyKey": "<VALORE CASUALE DI ALMENO 16 CARATTERI>",
  "customer": {
    "firstName": "Mario",
    "lastName": "Rossi",
    "phone": "+393331234567",
    "email": "mario@example.com",
    "preferredLanguage": "it",
    "marketingConsent": false,
    "privacyConsent": true
  }
}
```

`409 SLOT_NO_LONGER_AVAILABLE` include le alternative quando un altro cliente prende l'ultimo tavolo. `409 HOLD_EXPIRED` richiede un nuovo controllo disponibilità. `422 VALIDATION_ERROR` contiene gli errori campo per campo.

## Backoffice

| Metodo | Percorso | Permesso |
| --- | --- | --- |
| PATCH | `/api/admin/v1/reservations` | `reservations:write` |
| PATCH | `/api/admin/v1/waitlist` | `reservations:write` |
| GET | `/api/admin/v1/analytics/export` | `analytics:read` |
| GET, POST, PATCH | `/api/admin/v1/knowledge-base` | `calls:read` / `knowledge:write` |
| GET, PATCH | `/api/admin/v1/settings` | `settings:write` |
| POST | `/api/admin/v1/staff/invite` | `staff:write` |

Le pagine admin leggono i dati sul server. Supabase Realtime invalida la vista operativa quando cambiano prenotazioni, hold o waitlist.

## Assistente vocale

Retell chiama `POST /api/voice/tools/[tool]`. Tool disponibili:

- `restaurant-information`
- `knowledge-answer`
- `check-availability`
- `create-hold`
- `confirm-reservation`
- `find-reservation`
- `modify-reservation`
- `cancel-reservation`
- `add-reservation-note`
- `waitlist`
- `request-callback`
- `send-booking-confirmation`

Il server verifica `x-retell-signature` sul corpo grezzo. Il tool deve ricevere `locationId`; configurarlo come variabile fissa dell'agente.

## Webhook

| Provider | Percorso | Firma |
| --- | --- | --- |
| Retell | `/api/webhooks/retell` | `x-retell-signature` |
| Telnyx | `/api/webhooks/telnyx` | `telnyx-signature-ed25519`, `telnyx-timestamp` |
| Resend | `/api/webhooks/resend` | `svix-id`, `svix-timestamp`, `svix-signature` |

Il server risponde `202` dopo verifica e claim dell'evento. `webhook_events` impedisce doppie elaborazioni. In demo, l'endpoint accetta richieste non firmate solo quando il provider non ha credenziali e l'app non gira in produzione.
