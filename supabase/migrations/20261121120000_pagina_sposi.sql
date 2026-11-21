-- Pagina Sposi: testi della pagina, note degli Sposi, conferma in un'unica transazione.

-- Testi della pagina (dati dell'istanza, modificabili da Ale; niente testo nel codice).
create table public.blocco_pagina (
  chiave text primary key,
  ordine integer not null default 0,
  quando text not null check (quando in ('preventivo', 'preventivo_duo', 'sposi', 'sempre')),
  dati jsonb not null default '{}'::jsonb,   -- sopratitolo, titolo, corpo, passi, inclusi, banda, gallerie
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger blocco_pagina_updated_at before update on public.blocco_pagina
  for each row execute function privato.set_updated_at();
alter table public.blocco_pagina enable row level security;
revoke all on public.blocco_pagina from anon, authenticated;
grant select, insert, update, delete on public.blocco_pagina to authenticated;
grant all on public.blocco_pagina to service_role;
create policy blocco_pagina_solo_admin on public.blocco_pagina for all to authenticated
  using (privato.is_admin()) with check (privato.is_admin());

alter table public.preventivo add column note_cliente text;

-- Chi eroga la voce (es. pacchetti video → codice del videomaker). Vuoto = Ale.
alter table public.voce_listino add column collaboratore text;

-- Impostazioni dell'istanza, testi della pagina e contratto (una volta, poi si modificano dall'app).
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
  on conflict (chiave) do nothing;

  if dati ? 'contratto' and not exists (select 1 from public.contratto_versione) then
    insert into public.contratto_versione (testo) values (dati ->> 'contratto');
  end if;
end;
$$;
revoke all on function public.importa_istanza(jsonb) from public, anon;
grant execute on function public.importa_istanza(jsonb) to authenticated;

-- Conferma del preventivo dalla pagina Sposi. Chiamata solo dal server (service role),
-- dopo aver verificato il token e ricalcolato gli importi con il motore del listino.
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
  if stato_attuale not in ('qte_to_contact', 'qte_quote') then
    raise exception 'Questo preventivo risulta già confermato';
  end if;

  delete from public.importo where matrimonio_id = mid;
  insert into public.importo (matrimonio_id, voce, importo)
  select mid, voce, importo from jsonb_to_recordset(dati -> 'importi') as x(voce text, importo int);

  update public.preventivo set
    scelte = array(select jsonb_array_elements_text(dati -> 'scelte')),
    totale = (dati ->> 'totale')::int,
    confermato_il = now(),
    note_cliente = nullif(dati ->> 'note', '')
  where id = pid and matrimonio_id = mid;

  delete from public.sposo where matrimonio_id = mid;
  insert into public.sposo (matrimonio_id, ordine, nome, telefono, email, codice_fiscale, indirizzo, indirizzo_preparativi, consenso_promo)
  select mid, ordine, nome, telefono, email, codice_fiscale, indirizzo, nullif(indirizzo_preparativi, ''),
         coalesce((dati ->> 'consenso_promo')::boolean, false)
  from jsonb_to_recordset(dati -> 'sposi') as x(ordine int, nome text, telefono text, email text,
    codice_fiscale text, indirizzo text, indirizzo_preparativi text);

  insert into public.accettazione (preventivo_id, contratto_versione_id, ip, user_agent, nomi_dichiarati, hash_documento)
  values (pid, (dati -> 'accettazione' ->> 'contratto_versione_id')::uuid,
          nullif(dati -> 'accettazione' ->> 'ip', '')::inet, dati -> 'accettazione' ->> 'user_agent',
          dati -> 'accettazione' ->> 'nomi', dati -> 'accettazione' ->> 'hash');

  update public.matrimonio set
    stato = 'wdg_confermato',
    preparativi = exists (select 1 from public.sposo where matrimonio_id = mid and indirizzo_preparativi is not null),
    videomaker_id = coalesce((select id from public.collaboratore where codice = dati ->> 'videomaker'), videomaker_id)
  where id = mid;

  insert into public.evento_pagina (matrimonio_id, tipo, dettaglio)
  values (mid, 'invio', jsonb_build_object('azione', 'conferma', 'scelte', dati -> 'scelte'));
end;
$$;
revoke all on function public.registra_conferma(jsonb) from public, anon, authenticated;
grant execute on function public.registra_conferma(jsonb) to service_role;
