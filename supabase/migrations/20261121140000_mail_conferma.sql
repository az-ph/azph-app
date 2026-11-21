-- Mail di conferma: esito dell'invio, testi dei messaggi e contatti dei collaboratori da istanze/<nome>.
alter table public.invio add column errore text;

create or replace function public.importa_istanza(dati jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not privato.is_admin() then
    raise exception 'Solo l''admin con verifica in due passaggi';
  end if;
  update public.impostazioni set
    marchio = coalesce(dati -> 'impostazioni' -> 'marchio', marchio),
    zone = coalesce(array(select jsonb_array_elements_text(dati -> 'impostazioni' -> 'zone')), zone),
    url_recensioni = coalesce(dati -> 'impostazioni' ->> 'url_recensioni', url_recensioni),
    condizioni_pagamento = coalesce(dati -> 'impostazioni' ->> 'condizioni_pagamento', condizioni_pagamento),
    firma = coalesce(dati -> 'impostazioni' -> 'marchio' ->> 'firma', firma)
  where id;

  insert into public.blocco_pagina (chiave, ordine, quando, dati)
  select b ->> 'chiave', coalesce((b ->> 'ordine')::int, 0), b ->> 'quando', b - 'chiave' - 'ordine' - 'quando'
  from jsonb_array_elements(dati -> 'blocchi') as b
  on conflict (chiave) do update set ordine = excluded.ordine, quando = excluded.quando, dati = excluded.dati;

  insert into public.modello_messaggio (chiave, oggetto, corpo_mail, corpo_whatsapp)
  select m ->> 'chiave', m ->> 'oggetto', m ->> 'corpo_mail', m ->> 'corpo_whatsapp'
  from jsonb_array_elements(coalesce(dati -> 'messaggi', '[]'::jsonb)) as m
  on conflict (chiave) do update set oggetto = excluded.oggetto, corpo_mail = excluded.corpo_mail,
    corpo_whatsapp = excluded.corpo_whatsapp;

  update public.collaboratore c set
    email = coalesce(x ->> 'email', c.email),
    telefono = coalesce(x ->> 'telefono', c.telefono)
  from jsonb_array_elements(coalesce(dati -> 'collaboratori', '[]'::jsonb)) as x
  where c.codice = x ->> 'codice';

  if dati ? 'contratto' and not exists (select 1 from public.contratto_versione) then
    insert into public.contratto_versione (testo) values (dati ->> 'contratto');
  end if;
end;
$$;
revoke all on function public.importa_istanza(jsonb) from public, anon;
grant execute on function public.importa_istanza(jsonb) to authenticated;
