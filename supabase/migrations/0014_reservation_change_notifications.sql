-- Il database avvisa quando una prenotazione cambia.
--
-- Finora la dashboard lo scopriva chiedendo: una chiamata ogni quindici secondi,
-- che scarica tutte le prenotazioni della sede per accorgersi che spesso non è
-- cambiato niente. Costoso e lento allo stesso tempo — con la sala piena, quindici
-- secondi di ritardo sono un tavolo che aspetta.
--
-- `pg_notify` gira dentro la transazione che ha scritto la riga, quindi l'avviso
-- parte **dopo** che il dato è al sicuro: non esiste il caso di una notifica per
-- una prenotazione che poi non c'è.
--
-- Il messaggio resta minuscolo di proposito. `pg_notify` ha un limite di 8000
-- byte e sopra quello *fallisce la transazione*: mandare la prenotazione intera
-- significherebbe che una nota lunga del cliente fa fallire la prenotazione.
-- Viaggia l'essenziale, e chi ascolta rilegge dalle API.

create or replace function public.notify_reservation_change()
returns trigger
language plpgsql
as $$
declare
  v_row public.reservations;
begin
  v_row := case when tg_op = 'DELETE' then old else new end;
  perform pg_notify(
    'reservation_changed',
    json_build_object(
      'op', tg_op,
      'id', v_row.id,
      'locationId', v_row.location_id,
      'code', v_row.reservation_code,
      'status', v_row.status,
      'date', v_row.reservation_date
    )::text
  );
  return null;
end;
$$;

drop trigger if exists reservations_notify_change on public.reservations;

-- `after` e `for each row`: l'avviso descrive un fatto compiuto, non
-- un'intenzione. `statement` non saprebbe dire *quale* sede è cambiata, e senza
-- quello ogni dashboard si aggiornerebbe per le prenotazioni dell'altra.
create trigger reservations_notify_change
  after insert or update or delete on public.reservations
  for each row execute function public.notify_reservation_change();

comment on function public.notify_reservation_change() is
  'Avvisa sul canale reservation_changed. Payload minimo: il limite di pg_notify è 8000 byte e superarlo farebbe fallire la transazione che ha creato la prenotazione.';
