-- Area admin: nuovo Matrimonio in un'unica transazione (codice dell'anno, Sposi, link, preventivo v1).
create or replace function public.admin_nuovo_matrimonio(dati jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  mid uuid;
  anno int := coalesce(extract(year from (dati ->> 'data_inizio')::date)::int, extract(year from now())::int);
begin
  if not privato.is_admin() then
    raise exception 'Solo l''admin con verifica in due passaggi';
  end if;

  insert into public.matrimonio (codice_id, stato, fonte, data_inizio, ora_inizio, location_id, preparativi, formula_id, note_private)
  values (public.nuovo_codice_matrimonio(anno), coalesce((dati ->> 'stato')::stato_matrimonio, 'qte_quote'),
          nullif(dati ->> 'fonte', ''), (dati ->> 'data_inizio')::date, nullif(dati ->> 'ora_inizio', '')::time,
          nullif(dati ->> 'location_id', '')::uuid, (dati ->> 'preparativi')::boolean,
          nullif(dati ->> 'formula_id', '')::uuid, nullif(dati ->> 'note_private', ''))
  returning id into mid;

  insert into public.sposo (matrimonio_id, ordine, nome, telefono, email)
  select mid, ordine, nullif(nome, ''), nullif(telefono, ''), nullif(email, '')
  from jsonb_to_recordset(coalesce(dati -> 'sposi', '[]'::jsonb)) as x(ordine int, nome text, telefono text, email text)
  where coalesce(nome, '') <> '' or coalesce(email, '') <> '' or coalesce(telefono, '') <> '';

  insert into public.link_sposi (matrimonio_id, token) values (mid, dati ->> 'token');
  insert into public.preventivo (matrimonio_id, versione) values (mid, 1);
  return mid;
end;
$$;
revoke all on function public.admin_nuovo_matrimonio(jsonb) from public, anon;
grant execute on function public.admin_nuovo_matrimonio(jsonb) to authenticated;
