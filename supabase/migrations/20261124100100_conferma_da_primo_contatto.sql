-- La conferma degli Sposi vale da tutti gli stati di preventivo (anche Primo contatto).
create or replace function public.registra_conferma(dati jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  mid uuid := (dati ->> 'matrimonio_id')::uuid;
  pid uuid := (dati ->> 'preventivo_id')::uuid;
  stato_attuale stato_matrimonio;
begin
  select stato into stato_attuale from public.matrimonio where id = mid for update;
  if stato_attuale is null then raise exception 'Matrimonio non trovato'; end if;
  if stato_attuale::text not like 'qte\_%' then
    raise exception 'Questo preventivo risulta già confermato';
  end if;

  delete from public.importo where matrimonio_id = mid;
  insert into public.importo (matrimonio_id, voce, importo)
  select mid, voce, importo from jsonb_to_recordset(dati -> 'importi') as x(voce text, importo int);

  update public.preventivo set
    scelte = array(select jsonb_array_elements_text(dati -> 'scelte')),
    totale = (dati ->> 'totale')::int,
    confermato_il = now(),
    note_cliente = nullif(dati ->> 'note', ''),
    righe_confermate = coalesce(dati -> 'righe', '[]'::jsonb)
  where id = pid and matrimonio_id = mid;

  delete from public.sposo where matrimonio_id = mid;
  insert into public.sposo (matrimonio_id, ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo)
  select mid, ordine, nome, telefono, email, codice_fiscale, nullif(indirizzo, ''), nullif(indirizzo_preparativi, ''),
         coalesce((dati ->> 'consenso_promo')::boolean, false)
  from jsonb_to_recordset(dati -> 'sposi') as x(ordine int, nome text, telefono text, email text,
    codice_fiscale text, indirizzo text, indirizzo_preparativi text);

  insert into public.accettazione (preventivo_id, contratto_versione_id, ip, user_agent, nomi_dichiarati, hash_documento)
  values (pid, (dati -> 'accettazione' ->> 'contratto_versione_id')::uuid,
          nullif(dati -> 'accettazione' ->> 'ip', '')::inet, dati -> 'accettazione' ->> 'user_agent',
          dati -> 'accettazione' ->> 'nomi', dati -> 'accettazione' ->> 'hash');

  update public.matrimonio set
    stato = 'wdg_confermato',
    preparativi = case when exists (select 1 from public.sposo where matrimonio_id = mid and indirizzo_preparativi is not null)
                       then true else preparativi end,
    videomaker_id = coalesce((select id from public.collaboratore where codice = dati ->> 'videomaker'), videomaker_id)
  where id = mid;

  insert into public.evento_pagina (matrimonio_id, tipo, dettaglio)
  values (mid, 'invio', jsonb_build_object('azione', 'conferma', 'scelte', dati -> 'scelte'));
end;
$$;

revoke all on function public.registra_conferma(jsonb) from public, anon, authenticated;
grant execute on function public.registra_conferma(jsonb) to service_role;
