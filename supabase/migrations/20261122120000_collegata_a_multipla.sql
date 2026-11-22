-- voce_listino.collegata_a può elencare più codici separati da virgola (es. Album genitori con
-- Premium e Standard). La chiave esterna su un solo codice non lo permette: la sostituiscono trigger
-- con le stesse garanzie (codici esistenti, rinomina a cascata, niente cancellazione se ancora collegata).
alter table public.voce_listino drop constraint voce_listino_collegata_a_fkey;

create or replace function privato.voce_listino_collegata_a()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mancanti text;
begin
  new.collegata_a := nullif(regexp_replace(coalesce(new.collegata_a, ''), '\s', '', 'g'), '');
  if new.collegata_a is null then
    return new;
  end if;
  select string_agg(c, ', ') into mancanti
  from unnest(string_to_array(new.collegata_a, ',')) as c
  where c <> '' and not exists (select 1 from public.voce_listino v where v.codice = c);
  if mancanti is not null then
    raise exception 'Listino: "collegata a" di % indica codici che non esistono: %', new.codice, mancanti
      using errcode = '23503';
  end if;
  return new;
end;
$$;
create trigger voce_listino_collegata_a
  before insert or update of collegata_a on public.voce_listino
  for each row execute function privato.voce_listino_collegata_a();

-- Rinomina di un codice: aggiorna i collegamenti (come "on update cascade").
create or replace function privato.voce_listino_rinomina()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.voce_listino
  set collegata_a = array_to_string(array_replace(string_to_array(collegata_a, ','), old.codice, new.codice), ',')
  where old.codice = any (string_to_array(collegata_a, ','));
  return null;
end;
$$;
create trigger voce_listino_rinomina
  after update of codice on public.voce_listino
  for each row when (old.codice is distinct from new.codice)
  execute function privato.voce_listino_rinomina();

-- Cancellazione: vietata se a fine transazione qualche voce è ancora collegata (svuota e reimporta resta possibile).
create or replace function privato.voce_listino_cancellata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.voce_listino where old.codice = any (string_to_array(collegata_a, ','))) then
    raise exception 'Listino: % è ancora collegata ad altre voci', old.codice using errcode = '23503';
  end if;
  return null;
end;
$$;
create constraint trigger voce_listino_cancellata
  after delete on public.voce_listino
  deferrable initially deferred
  for each row execute function privato.voce_listino_cancellata();

revoke all on function privato.voce_listino_collegata_a(), privato.voce_listino_rinomina(), privato.voce_listino_cancellata() from public;
