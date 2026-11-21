-- importa_foglio: anche il collaboratore delle voci di listino e il link Sposi di ogni matrimonio.
create or replace function public.importa_foglio(dati jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  m jsonb;
  mid uuid;
  conteggi jsonb := '{}'::jsonb;
  n_matrimoni int := 0;
begin
  if not privato.is_admin() then
    raise exception 'Solo l''admin con verifica in due passaggi può importare';
  end if;
  if exists (select 1 from public.matrimonio) or exists (select 1 from public.voce_listino) then
    raise exception 'Il database contiene già dati: l''importazione si fa solo a database vuoto';
  end if;

  -- Listino (collegamenti dopo, quando tutte le voci esistono)
  insert into public.voce_listino (codice, categoria, voce, descrizione, prezzo, prezzo_barrato, gruppo, solo_se, riepilogo, collaboratore, attiva, ordine)
  select v.codice, v.categoria::categoria_listino, v.voce, v.descrizione, v.prezzo, v.prezzo_barrato,
         v.gruppo, v.solo_se, v.riepilogo, v.collaboratore, v.attiva, v.ordine
  from jsonb_to_recordset(dati -> 'listino') as v(
    codice text, categoria text, voce text, descrizione text, prezzo int, prezzo_barrato int,
    gruppo text, solo_se text, riepilogo text, collaboratore text, attiva boolean, ordine int);
  update public.voce_listino l set collegata_a = v.collegata_a
  from jsonb_to_recordset(dati -> 'listino') as v(codice text, collegata_a text)
  where l.codice = v.codice and v.collegata_a is not null;

  insert into public.location (nome, comune, provincia, galleria_url, copertina_url)
  select nome, comune, provincia, galleria_url, copertina_url
  from jsonb_to_recordset(dati -> 'location') as x(nome text, comune text, provincia text, galleria_url text, copertina_url text);

  insert into public.collaboratore (codice, nome, ruolo)
  select codice, nome, ruolo::ruolo_collaboratore
  from jsonb_to_recordset(dati -> 'collaboratori') as x(codice text, nome text, ruolo text);

  insert into public.fornitore (categoria, nome, social)
  select categoria, nome, social
  from jsonb_to_recordset(dati -> 'fornitori') as x(categoria text, nome text, social text);

  for m in select * from jsonb_array_elements(dati -> 'matrimoni') loop
    insert into public.matrimonio (codice_id, stato, fonte, data_inizio, data_fine, ora_inizio, ora_fine,
      location_id, preparativi, formula_id, note_private, galleria_url, copertina_url, link_upyourshoot,
      pagina_congiunta, videomaker_id, memory_box_consegnata, recensione_ricevuta)
    values (
      m ->> 'codice_id', (m ->> 'stato')::stato_matrimonio, m ->> 'fonte',
      (m ->> 'data_inizio')::date, (m ->> 'data_fine')::date, (m ->> 'ora_inizio')::time, (m ->> 'ora_fine')::time,
      (select id from public.location where nome = m ->> 'location' order by created_at limit 1),
      (m ->> 'preparativi')::boolean,
      (select id from public.voce_listino where codice = m ->> 'formula'),
      m ->> 'note_private', m ->> 'galleria_url', m ->> 'copertina_url', m ->> 'link_upyourshoot',
      coalesce((m ->> 'pagina_congiunta')::boolean, false),
      (select id from public.collaboratore where codice = m ->> 'videomaker'),
      coalesce((m ->> 'memory_box_consegnata')::boolean, false),
      coalesce((m ->> 'recensione_ricevuta')::boolean, false)
    ) returning id into mid;
    n_matrimoni := n_matrimoni + 1;

    insert into public.sposo (matrimonio_id, ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo)
    select mid, ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, coalesce(consenso_promo, false)
    from jsonb_to_recordset(m -> 'sposi') as x(ordine int, nome text, telefono text, email text,
      codice_fiscale text, indirizzo text, indirizzo_preparativi text, consenso_promo boolean);

    if m -> 'preventivo' is not null and jsonb_typeof(m -> 'preventivo') = 'object' then
      insert into public.preventivo (matrimonio_id, versione, opzioni, prezzi_speciali, preselezione, scelte, totale, inviato_il, confermato_il)
      values (mid,
        coalesce((m -> 'preventivo' ->> 'versione')::int, 1),
        coalesce(m -> 'preventivo' -> 'opzioni', '{}'::jsonb),
        coalesce(m -> 'preventivo' -> 'prezzi_speciali', '{}'::jsonb),
        coalesce(array(select jsonb_array_elements_text(m -> 'preventivo' -> 'preselezione')), '{}'),
        coalesce(array(select jsonb_array_elements_text(m -> 'preventivo' -> 'scelte')), '{}'),
        (m -> 'preventivo' ->> 'totale')::int,
        (m -> 'preventivo' ->> 'inviato_il')::timestamptz,
        (m -> 'preventivo' ->> 'confermato_il')::timestamptz);
    end if;

    insert into public.importo (matrimonio_id, voce, importo)
    select mid, voce, importo from jsonb_to_recordset(m -> 'importi') as x(voce text, importo int);

    insert into public.pagamento (matrimonio_id, tipo, importo, pagato_il, note)
    select mid, 'altro', (m ->> 'incassato')::int, current_date, 'Già incassato al momento dell''importazione dal foglio'
    where coalesce((m ->> 'incassato')::int, 0) > 0;

    if m -> 'album' is not null and jsonb_typeof(m -> 'album') = 'object' then
      insert into public.album (matrimonio_id, tipo, cartella_anteprima, approvato_il, note_modifiche)
      values (mid, (m -> 'album' ->> 'tipo')::tipo_album, m -> 'album' ->> 'cartella',
              (m -> 'album' ->> 'approvato_il')::timestamptz, m -> 'album' ->> 'note');
    end if;

    insert into public.timeline (matrimonio_id, giorno, ora, fase, luogo, nota_privata, ordine)
    select mid, coalesce(giorno, 1), ora, fase, luogo, coalesce(nota_privata, false), ordine
    from jsonb_to_recordset(m -> 'timeline') as x(giorno int, ora time, fase text, luogo text, nota_privata boolean, ordine int);

    insert into public.matrimonio_fornitore (matrimonio_id, fornitore_id, ruolo)
    select distinct on (f.id) mid, f.id, x.categoria
    from jsonb_to_recordset(m -> 'fornitori') as x(categoria text, nome text)
    join public.fornitore f on f.categoria = x.categoria and f.nome = x.nome;

    if m ->> 'token' is not null then
      insert into public.link_sposi (matrimonio_id, token) values (mid, m ->> 'token');
    end if;

    if m ->> 'codice_legacy' is not null then
      insert into public.codice_legacy (codice4, matrimonio_id, scade_il)
      values (lower(m ->> 'codice_legacy'), mid, (m ->> 'legacy_scade_il')::date)
      on conflict (codice4) do nothing;
    end if;
  end loop;

  -- I prossimi codici partono dopo l'ultimo importato di ogni anno.
  insert into public.contatore_anno (anno, ultimo)
  select split_part(codice_id, '-', 1)::int, max(split_part(codice_id, '-', 2)::int)
  from public.matrimonio
  where codice_id ~ '^\d{4}-\d+$'
  group by 1
  on conflict (anno) do update set ultimo = greatest(public.contatore_anno.ultimo, excluded.ultimo);

  select jsonb_build_object(
    'matrimoni', n_matrimoni,
    'sposi', (select count(*) from public.sposo),
    'preventivi', (select count(*) from public.preventivo),
    'importi', (select count(*) from public.importo),
    'pagamenti', (select count(*) from public.pagamento),
    'timeline', (select count(*) from public.timeline),
    'location', (select count(*) from public.location),
    'fornitori', (select count(*) from public.fornitore),
    'listino', (select count(*) from public.voce_listino)
  ) into conteggi;
  return conteggi;
end;
$$;

revoke all on function public.importa_foglio(jsonb) from public, anon;
grant execute on function public.importa_foglio(jsonb) to authenticated;
