-- Quale informativa il cliente ha accettato, non solo quando.
--
-- `privacy_consent_at` diceva già il momento. Non bastava: l'informativa cambia
-- nel tempo, e un consenso senza la versione di ciò che si è accettato non è
-- dimostrabile. Se fra un anno il testo viene riscritto, senza questa colonna
-- non c'è modo di sapere se un cliente ha accettato la versione vecchia o la
-- nuova — che è esattamente la domanda a cui bisogna saper rispondere.
--
-- Nullable di proposito: i consensi già raccolti non possono essere riscritti
-- con una versione che nessuno ha mostrato loro. `null` significa "raccolto
-- prima che tenessimo traccia della versione", e va letto così, non colmato.
--
-- La colonna si riempie dal codice dell'applicazione, subito dopo la conferma,
-- come già avviene per `reservation_code`: `confirm_reservation_from_hold` è una
-- funzione `security definer` che governa una transazione delicata, e
-- riscriverla per aggiungere due campi sarebbe un rischio molto più grande del
-- problema che risolve.

alter table public.customers
  add column if not exists privacy_policy_version text,
  add column if not exists marketing_consent_version text;

comment on column public.customers.privacy_policy_version is
  'Versione dell''informativa mostrata quando il consenso è stato dato. Null = consenso raccolto prima del tracciamento.';
comment on column public.customers.marketing_consent_version is
  'Versione dell''informativa in vigore quando è stato dato il consenso marketing. Null = nessun consenso marketing, o raccolto prima del tracciamento.';
