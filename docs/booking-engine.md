# Motore di prenotazione

`src/domains/availability/availability-service.ts` è un servizio puro condiviso da web, backoffice e tool vocali. Riceve dati e regole dal repository; non conosce Supabase né i componenti React.

## Controlli

Per ogni richiesta verifica sede e canale attivi, servizio del giorno, finestra minima e massima di prenotazione, dimensione del gruppo, chiusure, durata, riassetto, coperti, picco arrivi, tavoli, combinazioni, hold e prenotazioni sovrapposte. Le chiusure parziali eliminano solo la sala o il tavolo indicato; una chiusura completa elimina l'intero slot.

Le durate predefinite sono 90, 120, 150 e 180 minuti per le fasce 1–2, 3–4, 5–6 e 7–10 ospiti. Sono modificabili dal backoffice e vengono lette dalla stessa regola usata dai repository.

## Assegnazione

L'algoritmo crea candidati singoli e combinati. Lo score parte dai posti inutilizzati e aggiunge penalità per area non preferita, combinazione, tavolo strategico e uso non necessario di un tavolo accessibile. Vince lo score più basso; a parità, vince la soluzione con meno tavoli.

Un requisito di accessibilità è vincolante. Una preferenza di sala o tavolo influenza lo score ma può lasciare spazio a un'alternativa reale.

## Concorrenza

Il flusso di produzione è:

1. calcolo disponibilità;
2. `create_reservation_hold` con advisory lock ordinati;
3. raccolta dati ospite;
4. `confirm_reservation_from_hold` con lock dell'hold, ricontrollo di capacità e idempotency key;
5. assegnazione tavoli e creazione evento nella stessa transazione;
6. notifiche dopo il commit.

Il vincolo GiST resta l'ultima difesa contro la sovrapposizione. La modifica tramite token e il drag-and-drop amministrativo usano RPC atomiche distinte, quindi non esiste un intervallo in cui la vecchia assegnazione è rimossa senza che la nuova sia validata.

## Tempo locale

Le date e gli orari scelti dall'ospite sono interpretati in `Europe/Rome`, compresi i cambi DST, poi convertiti in ISO UTC. UI, email, CSV e riepiloghi riconvertono i timestamp nella timezone della sede.

## Errori

Un conflitto restituisce `409` e, quando disponibili, alternative ricalcolate. Un hold scaduto richiede un nuovo controllo. Gruppi oltre la soglia entrano nel percorso di approvazione/lista d'attesa. Il fallimento di email o SMS non annulla una prenotazione già confermata.
