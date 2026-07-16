# Verifica di conformità al preventivo

Documento di riferimento: `Quotazione-Loly Piarttaforma (1).pdf`, datato 17/06/2026, cliente indicato nel PDF “Kaisen Sushi”. La piattaforma usa ora una regia neutrale e due profili ristorante separati, entrambi configurabili quando verranno forniti dati e identità definitive.

## Matrice requisiti

| Requisito del preventivo | Esito nel prodotto | Evidenza |
| --- | --- | --- |
| Link pubblico unico con scelta del ristorante | Conforme dopo intervento | `/it/book` presenta i due ristoranti; ciascuno conserva anche il proprio link diretto. |
| Prenotazione con nome, telefono, ristorante, data, orario, persone e note | Conforme | Wizard pubblico in cinque passaggi, con email opzionale, allergie, accessibilità e consensi. |
| Design personalizzato e responsive | Conforme | Interfaccia dedicata al brand, verificabile su desktop, tablet e smartphone. |
| Area login riservata | Conforme | Supabase Auth in produzione e ambiente demo esplicitamente separato. Nessuna credenziale demo viene mostrata in produzione. |
| Accesso autonomo per ogni ristorante | Conforme dopo intervento | Ristoranti ammessi salvati nella sessione; selettore, API e policy RLS impediscono accessi fuori contesto. |
| Amministrazione centrale dei due ristoranti | Conforme dopo intervento | Pagina “Ristoranti” con metriche aggregate e flusso recente unificato; l’amministratore può entrare nel dettaglio del ristorante corretto. |
| Consultazione prenotazioni e dati cliente | Conforme | Agenda, lista, ricerca, filtri, dettaglio ospite e contatti. |
| Controllo di data, ora e ristorante | Conforme | Calendario operativo per ristorante, servizio e tavolo. |
| Storico delle richieste | Conforme | Navigazione per data, stati conclusi/cancellati/no-show ed eventi di prenotazione persistenti. |
| Notifica interna per nuova prenotazione | Conforme dopo intervento | Centro notifiche nella barra amministrativa, aggiornato via Realtime e controllo periodico. |
| Notifica sonora | Conforme dopo intervento | Segnale Web Audio attivabile per dispositivo; preferenza conservata nel browser. |
| Uso su monitor o dispositivo dedicato | Conforme | Dashboard live, indicatore connessione, avvisi operativi e guida di apertura servizio. |
| Configurazione iniziale | Conforme | Orari settimanali, capienza, preavviso, durata, arrivi per slot, waitlist, avvisi e modalità live/richiesta/pausa separate per ristorante. |
| Test tecnici prima della pubblicazione | Conforme nel codice | Suite Vitest, lint, TypeScript, build e flusso Playwright predisposti. I controlli devono essere rieseguiti su staging prima del go-live. |
| Formazione base | Conforme dopo intervento | Sezione “Guida operativa” nel pannello e manuale operativo in `docs/manuale-operativo.md`. |
| Base per future integrazioni AI | Conforme, oltre il perimetro | Repository e adapter separati; AI voce e provider restano disattivabili e opzionali. |

## Differenze corrette

1. La home portava direttamente al primo ristorante: ora il cliente sceglie esplicitamente il ristorante.
2. L’icona notifiche non rappresentava un vero centro avvisi e non esisteva il segnale sonoro: ora entrambi sono operativi.
3. L’interfaccia dichiarava dati separati, ma le autorizzazioni originarie erano in parte limitate solo all’organizzazione: ora sessione, API, repository e RLS rispettano il ristorante.
4. La regia centrale mostrava due schede ma non un flusso prenotazioni unificato: ora presenta le attività recenti di entrambi i ristoranti.
5. La pagina integrazioni considerava AI, SMS ed email necessari per la produzione, mentre il preventivo li esclude: ora distingue il booking essenziale dai canali opzionali.
6. In configurazione di produzione la pagina login poteva mostrare credenziali demo: la sezione è stata rimossa.
7. Mancava una formazione consultabile dentro il prodotto: è stata aggiunta una guida operativa.
8. I due punti operativi erano modellati come sedi dello stesso ristorante: ora hanno `restaurant_id`, configurazione pubblica, knowledge base, prenotazioni demo e migrazione dati separati, sotto la stessa organizzazione e regia.

## Dipendenze non risolvibili solo nel codice

- conferma definitiva di ragione sociale, marchio, logo, P.IVA, indirizzi, telefoni, email e orari;
- approvazione legale dei testi privacy, condizioni, consensi, conservazione dati e gestione allergie;
- progetto Supabase, dominio, hosting e variabili di produzione;
- account reali del personale e assegnazione dei ristoranti;
- eventuali provider a pagamento per email, SMS, WhatsApp o voce AI, esclusi dal preventivo;
- date, canale e durata della fase di supporto post-consegna.

Finché questi elementi non vengono forniti e approvati dal cliente, l’applicazione è tecnicamente pronta per demo/staging ma non va considerata autorizzata a trattare prenotazioni reali.
