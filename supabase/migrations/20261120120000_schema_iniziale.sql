-- AZ-ph · schema iniziale (v1)
-- Regola del progetto: ogni tabella nasce con RLS attiva, grant minimi espliciti e policy,
-- tutto nella stessa migrazione. Nessun accesso per il ruolo anon.

-- ---------------------------------------------------------------
-- Utilità
-- ---------------------------------------------------------------

create extension if not exists pgcrypto;

create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;

-- Admin = utente autenticato con app_metadata.ruolo = 'admin'
-- (app_metadata è modificabile solo lato server, non dall'utente).
create or replace function privato.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'ruolo') = 'admin', false)
$$;
grant usage on schema privato to authenticated;
grant execute on function privato.is_admin() to authenticated;

create or replace function privato.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Tipi
-- ---------------------------------------------------------------

create type public.stato_matrimonio as enum (
  'qte_to_contact', 'qte_quote',
  'wdg_confermato', 'wdg_lightroom', 'wdg_invoice', 'wdg_album_todo', 'wdg_album',
  'clo_completed', 'clo_lost', 'clo_no_answer'
);

create type public.fonte as enum ('MAT', 'IGR', 'FBO', 'PSP', 'WEB', 'VDB', 'ALTRO');

create type public.canale_richiesta as enum ('form_pubblico', 'form_interno', 'intake', 'manuale');

create type public.esito_controllo as enum ('libera', 'occupata', 'altro_preventivo');

create type public.categoria_listino as enum (
  'formula', 'omaggio', 'extra', 'prewedding', 'album', 'replica', 'video-base', 'video', 'duo'
);

create type public.tipo_pagamento as enum ('acconto', 'saldo', 'album', 'album_genitori', 'altro');

create type public.ruolo_collaboratore as enum ('videomaker', 'secondo_operatore', 'fotografo');

create type public.tipo_album as enum ('standard', 'premium');

create type public.stato_invio as enum ('bozza', 'inviato', 'errore');

create type public.tipo_evento_pagina as enum ('apertura', 'selezione', 'deselezione', 'invio');

-- ---------------------------------------------------------------
-- Tabelle
-- ---------------------------------------------------------------

create table public.impostazioni (
  id boolean primary key default true check (id),  -- riga unica
  marchio jsonb not null default '{}'::jsonb,
  colori jsonb not null default '{}'::jsonb,
  firma text,
  zone text[] not null default '{}',
  condizioni_pagamento text,
  url_recensioni text,
  conservazione jsonb not null default
    '{"richieste_mesi": 12, "preventivi_persi_mesi": 24, "matrimoni_chiusi_anni": 10}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.location (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  comune text,
  provincia text,
  galleria_url text,
  copertina_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fornitore (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  nome text not null,
  social text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collaboratore (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ruolo public.ruolo_collaboratore not null,
  email text,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voce_listino (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  categoria public.categoria_listino not null,
  voce text not null,
  descrizione text,
  prezzo integer not null default 0 check (prezzo >= 0),          -- centesimi
  prezzo_barrato integer check (prezzo_barrato >= 0),             -- centesimi
  gruppo text,
  collegata_a text references public.voce_listino (codice) on update cascade,
  solo_se text,
  attiva boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Progressivo per anno: 2027-001, 2027-002…
create table public.contatore_anno (
  anno integer primary key,
  ultimo integer not null default 0
);

create table public.matrimonio (
  id uuid primary key default gen_random_uuid(),
  codice_id text not null unique,
  stato public.stato_matrimonio not null default 'qte_to_contact',
  fonte public.fonte,
  data_inizio date,
  data_fine date,
  ora_inizio time,
  ora_fine time,
  location_id uuid references public.location (id) on delete set null,
  preparativi boolean,
  formula_id uuid references public.voce_listino (id) on delete set null,
  note_private text,
  galleria_url text,
  link_upyourshoot text,
  pagina_congiunta boolean not null default false,
  videomaker_id uuid references public.collaboratore (id) on delete set null,
  anonimizzato_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index matrimonio_data_idx on public.matrimonio (data_inizio);
create index matrimonio_stato_idx on public.matrimonio (stato);

create table public.sposo (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  ordine smallint not null check (ordine in (1, 2)),
  nome text,
  cognome text,
  telefono text,
  email text,
  consenso_promo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matrimonio_id, ordine)
);

create table public.richiesta (
  id uuid primary key default gen_random_uuid(),
  canale public.canale_richiesta not null,
  fonte public.fonte,
  nome text,
  telefono text,
  email text,
  testo_originale text,
  data_chiesta date,
  ora_cerimonia time,
  luoghi text,
  preparativi boolean,
  esito_controllo public.esito_controllo,
  matrimonio_id uuid references public.matrimonio (id) on delete set null,
  ricevuta_il timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index richiesta_ricevuta_idx on public.richiesta (ricevuta_il);

create table public.preventivo (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  versione integer not null default 1,
  opzioni jsonb not null default '{}'::jsonb,
  prezzi_speciali jsonb not null default '{}'::jsonb,
  preselezione text[] not null default '{}',
  scelte text[] not null default '{}',
  totale integer,                                                 -- centesimi
  inviato_il timestamptz,
  confermato_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (matrimonio_id, versione)
);

create table public.contratto_versione (
  id uuid primary key default gen_random_uuid(),
  testo text not null,
  valido_dal date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.accettazione (
  id uuid primary key default gen_random_uuid(),
  preventivo_id uuid not null references public.preventivo (id) on delete restrict,
  contratto_versione_id uuid not null references public.contratto_versione (id) on delete restrict,
  accettato_il timestamptz not null default now(),
  ip inet,
  user_agent text,
  nomi_dichiarati text,
  hash_documento text not null,
  created_at timestamptz not null default now()
);

create table public.pagamento (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  tipo public.tipo_pagamento not null,
  importo integer not null check (importo >= 0),                 -- centesimi
  scadenza date,
  pagato_il date,
  metodo text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.timeline (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  giorno smallint not null default 1,
  ora time,
  fase text,
  luogo text,
  nota_privata boolean not null default false,
  ordine integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matrimonio_fornitore (
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  fornitore_id uuid not null references public.fornitore (id) on delete cascade,
  ruolo text,
  primary key (matrimonio_id, fornitore_id)
);

create table public.album (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null unique references public.matrimonio (id) on delete cascade,
  tipo public.tipo_album,
  cartella_anteprima text,
  approvato_il timestamptz,
  note_modifiche text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.modello_messaggio (
  chiave text primary key,
  oggetto text,
  corpo_mail text,
  corpo_whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invio (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid references public.matrimonio (id) on delete cascade,
  modello text references public.modello_messaggio (chiave) on update cascade,
  canale text not null check (canale in ('mail', 'whatsapp')),
  stato public.stato_invio not null default 'bozza',
  inviato_il timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.link_sposi (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  token text not null unique check (char_length(token) >= 22),
  creato_il timestamptz not null default now(),
  revocato_il timestamptz
);

-- Nessun IP, nessun cookie: solo cosa è successo e quando.
create table public.evento_pagina (
  id bigint generated always as identity primary key,
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  tipo public.tipo_evento_pagina not null,
  dettaglio jsonb not null default '{}'::jsonb,
  avvenuto_il timestamptz not null default now()
);
create index evento_pagina_matrimonio_idx on public.evento_pagina (matrimonio_id, avvenuto_il);

create table public.codice_legacy (
  codice4 text primary key,
  matrimonio_id uuid not null references public.matrimonio (id) on delete cascade,
  scade_il date
);

create table public.log_job (
  id bigint generated always as identity primary key,
  nome text not null,
  esito text not null,
  dettaglio jsonb,
  eseguito_il timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'impostazioni', 'location', 'fornitore', 'collaboratore', 'voce_listino', 'matrimonio',
    'sposo', 'richiesta', 'preventivo', 'pagamento', 'timeline', 'album',
    'modello_messaggio', 'invio'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function privato.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end $$;

-- Il contratto e le accettazioni non si modificano mai.
create or replace function privato.vieta_modifica()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tabella in sola aggiunta: % non modificabile', tg_table_name;
end;
$$;
create trigger contratto_versione_immutabile before update on public.contratto_versione
  for each row execute function privato.vieta_modifica();
create trigger accettazione_immutabile before update on public.accettazione
  for each row execute function privato.vieta_modifica();

-- ---------------------------------------------------------------
-- Codice matrimonio (2027-001) dall'anno della data evento
-- ---------------------------------------------------------------

create or replace function public.nuovo_codice_matrimonio(p_anno integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into public.contatore_anno (anno, ultimo) values (p_anno, 1)
  on conflict (anno) do update set ultimo = public.contatore_anno.ultimo + 1
  returning ultimo into n;
  return p_anno::text || '-' || lpad(n::text, 3, '0');
end;
$$;
revoke all on function public.nuovo_codice_matrimonio(integer) from public, anon;
grant execute on function public.nuovo_codice_matrimonio(integer) to authenticated, service_role;

-- ---------------------------------------------------------------
-- RLS + grant espliciti + policy (solo admin)
-- ---------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'impostazioni', 'location', 'fornitore', 'collaboratore', 'voce_listino', 'contatore_anno',
    'matrimonio', 'sposo', 'richiesta', 'preventivo', 'contratto_versione', 'accettazione',
    'pagamento', 'timeline', 'matrimonio_fornitore', 'album', 'modello_messaggio', 'invio',
    'link_sposi', 'evento_pagina', 'codice_legacy', 'log_job'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (privato.is_admin()) with check (privato.is_admin())',
      t || '_solo_admin', t
    );
  end loop;
end $$;

-- Contratto e accettazioni: l'admin legge e aggiunge, non modifica né cancella.
revoke update, delete on public.contratto_versione from authenticated;
revoke update, delete on public.accettazione from authenticated;

grant usage on all sequences in schema public to authenticated, service_role;

-- Riga unica delle impostazioni
insert into public.impostazioni (id) values (true) on conflict do nothing;
