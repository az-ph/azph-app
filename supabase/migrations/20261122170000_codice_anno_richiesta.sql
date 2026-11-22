-- Il codice del Matrimonio usa l'anno in cui nasce la richiesta (come nel foglio: 2026-091 è un
-- Matrimonio del 2027), non l'anno della data del Matrimonio.
create or replace function public.admin_nuovo_matrimonio(dati jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  mid uuid;
  anno int := extract(year from (now() at time zone 'Europe/Rome'))::int;
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

-- Il Matrimonio di prova creato con la regola vecchia (2027-001) prende il primo numero libero del 2026
-- e il contatore del 2027 torna libero.
do $$
begin
  if exists (select 1 from public.matrimonio where codice_id = '2027-001' and note_private like 'PROVA%') then
    update public.matrimonio set codice_id = public.nuovo_codice_matrimonio(2026)
    where codice_id = '2027-001' and note_private like 'PROVA%';
    if not exists (select 1 from public.matrimonio where codice_id like '2027-%') then
      delete from public.contatore_anno where anno = 2027;
    end if;
  end if;
end $$;
