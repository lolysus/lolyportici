# Manuale operativo Regia Ristoranti

## Accesso e ristorante

Accedi da `/login` con l’account di lavoro. Il sistema mostra esclusivamente i ristoranti assegnati all’utente. Proprietario e amministrazione centrale possono vedere entrambi i ristoranti; il personale operativo vede solo quello autorizzato.

Il nome del ristorante attivo è sempre visibile nella barra superiore. Prima di modificare prenotazioni o impostazioni, controlla che sia quello corretto.

## Apertura del servizio

1. Apri il pannello su monitor, tablet o computer dedicato.
2. Controlla l’indicatore `Live`. In assenza di Supabase Realtime, il pannello continua a verificare le prenotazioni periodicamente.
3. Apri la campana delle notifiche e abilita `Suono attivo`. Il browser richiede un’interazione del personale prima di poter riprodurre audio.
4. Controlla dashboard, coperti previsti, lista d’attesa, allergie e gruppi numerosi.
5. Apri l’agenda e verifica prenotazioni senza tavolo o richieste da approvare.

## Nuova prenotazione

Quando arriva una prenotazione:

- compare un avviso in basso a destra;
- il contatore della campana aumenta;
- il dispositivo riproduce un doppio segnale se il suono è attivo;
- il collegamento nell’avviso apre data e prenotazione corrette.

Nel dettaglio controlla nome, telefono, numero ospiti, orario, note, allergie, accessibilità e tavolo.

## Stati operativi

- `Da approvare`: richiesta che richiede conferma manuale.
- `Confermata`: tavolo previsto e cliente atteso.
- `Arrivato`: il cliente si trova nel locale.
- `Al tavolo`: il tavolo è occupato.
- `Completata`: servizio concluso e prenotazione archiviata nello storico.
- `Cancellata` o `No-show`: richiesta conclusa senza servizio.

Non saltare gli stati: alimentano correttamente dashboard, disponibilità e storico.

## Modalità della sede

In `Impostazioni`:

- `Operativa` accetta prenotazioni secondo disponibilità;
- `Solo richieste` invia le richieste allo staff per approvazione;
- `In pausa` sospende nuovi booking senza cancellare dati o regole.

Ogni modifica vale soltanto per la sede selezionata.

## Link da pubblicare

In `Integrazioni` trovi:

- link generale con scelta sede, consigliato per Google Business, sito e profili social comuni;
- link diretto Centro;
- link diretto Mare.

Usa il pulsante copia per evitare errori nei materiali digitali o stampati.

## Chiusura e controllo

Alla fine del servizio completa le prenotazioni ancora al tavolo, verifica cancellazioni e no-show, controlla la lista d’attesa e segnala eventuali anomalie. Non cancellare manualmente righe dal database: lo storico è parte della tracciabilità operativa.

## Problemi frequenti

- Nessun suono: apri la campana, abilita il suono e interagisci una volta con la pagina; controlla anche volume e modalità silenziosa del dispositivo.
- Sede errata o assente: l’account non è assegnato correttamente; contatta l’amministratore centrale.
- Nessuno slot online: verifica orari, preavviso minimo, capienza, tavoli, chiusure e modalità della sede.
- Indicatore Offline: il pannello continua il controllo periodico; verifica rete e configurazione Supabase.
- Dati non persistenti: la barra `Ambiente sandbox` indica che il database di produzione non è collegato.
