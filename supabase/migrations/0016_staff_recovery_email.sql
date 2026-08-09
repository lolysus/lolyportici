-- Dove arriva il link del recupero, quando non è l'indirizzo con cui si entra.
--
-- Finora il link andava all'email dell'account, che è anche il nome utente. Le
-- due cose però rispondono a esigenze diverse:
--
-- - il **nome utente** deve essere distinto per account, altrimenti il login non
--   sa chi sta entrando;
-- - il **recapito** può essere condiviso, ed è quello che serve quando la gestione
--   è interna e una sola casella raccoglie i link di tutte le sedi.
--
-- C'è anche un vincolo che rende la separazione necessaria adesso: finché nessun
-- dominio è verificato, Resend consegna **solo** all'indirizzo del titolare
-- dell'account. Senza questa colonna, il recupero di Ardea non poteva arrivare da
-- nessuna parte, e l'unico modo di farlo funzionare sarebbe stato dare a due
-- account lo stesso nome utente — cioè rompere il login per far funzionare il
-- recupero.
--
-- Nullable: `null` significa "manda all'indirizzo dell'account", che resta il
-- comportamento giusto quando il dominio sarà verificato.

alter table public.staff_accounts
  add column if not exists recovery_email text;

comment on column public.staff_accounts.recovery_email is
  'Dove spedire il link del recupero password, se diverso dal nome utente. Null = manda all''email dell''account.';
