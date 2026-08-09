-- L'avviso non porta più il codice della prenotazione, perché non poteva dirlo.
--
-- Il codice si assegna in due passi: `confirm_reservation_from_hold` inserisce un
-- `MG-xxxxxx` provvisorio, poi l'applicazione lo riscrive col prefisso della sede
-- (`YK-`, `KS-`). Il trigger scatta all'inserimento, quindi fotografava il codice
-- provvisorio: misurato in produzione, un avviso con `MG-FC367D` per la
-- prenotazione `YK-3D3998`.
--
-- Non rompeva niente — chi ascolta rilegge dalle API e vede il codice giusto — ma
-- un campo corretto solo dopo il secondo avviso è una trappola per chiunque lo
-- usi in futuro credendolo affidabile. Meglio non averlo che averlo sbagliato.
--
-- La via alternativa era far assegnare il codice definitivo alla funzione di
-- conferma. È una `security definer` che governa la transazione più delicata del
-- sistema, e riscriverla per sistemare un campo informativo è un rischio
-- sproporzionato al problema.

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
      'status', v_row.status,
      'date', v_row.reservation_date
    )::text
  );
  return null;
end;
$$;

comment on function public.notify_reservation_change() is
  'Avvisa sul canale reservation_changed. Payload minimo: il limite di pg_notify è 8000 byte e superarlo farebbe fallire la transazione. Nessun reservation_code: all''inserimento è ancora quello provvisorio.';
