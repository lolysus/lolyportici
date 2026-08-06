-- Le chiusure straordinarie ora si leggono a ogni apertura della pagina di
-- prenotazione e del pannello, sempre nella stessa forma: quelle di una sede,
-- da oggi in avanti. Senza indice è una scansione completa della tabella a
-- ogni richiesta — trascurabile con dieci righe, non più quando due
-- ristoranti accumulano qualche anno di ferie, festivi ed eventi privati.
create index if not exists closures_location_date_idx
  on public.special_openings_closures(location_id, date);
