-- Percorso dell'album nella pagina Sposi: selezione e copertina dagli Sposi, anteprima caricata dall'admin,
-- approvazione o richiesta di modifiche. La tabella album ha già RLS, grant e policy (schema iniziale).

alter table public.album
  add column selezione_il timestamptz,
  add column copertina text check (copertina is null or copertina ~ '^[a-z0-9_-]{1,40}$'),
  add column copertina_nota text check (char_length(copertina_nota) <= 500),
  add column note_sposi text check (char_length(note_sposi) <= 2000),
  add column anteprima_path text,
  add column anteprima_nome text,
  add column anteprima_il timestamptz,
  add column modifiche_il timestamptz;

-- Anteprime degli album: spazio privato, senza policy per anon e authenticated.
-- Ci accede solo il server (service role): caricamento con link firmato dall'admin, lettura con link temporaneo
-- dalla pagina degli Sposi di quel Matrimonio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album-anteprime', 'album-anteprime', false, 52428800,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Testi del percorso album: blocco a parte, non mostrato nel flusso normale della pagina.
alter table public.blocco_pagina drop constraint blocco_pagina_quando_check;
alter table public.blocco_pagina add constraint blocco_pagina_quando_check
  check (quando in ('preventivo', 'preventivo_duo', 'sposi', 'sempre', 'album'));

-- Album scelto dopo la consegna delle foto: righe per il riepilogo della pagina (il preventivo confermato non si tocca).
alter table public.album
  add column scelto_il timestamptz,
  add column scelta jsonb not null default '[]'::jsonb check (jsonb_typeof(scelta) = 'array');

-- Consegna delle foto: l'uscita da "Lightroom", verso qualsiasi stato. Serve alla proposta dell'album.
alter table public.matrimonio
  add column foto_consegnate_il date,
  add column album_proposto_il date;

create function privato.segna_consegna_foto() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.stato = 'wdg_lightroom' and new.stato <> 'wdg_lightroom' and new.foto_consegnate_il is null then
    new.foto_consegnate_il := (now() at time zone 'Europe/Rome')::date;
  end if;
  return new;
end $$;

create trigger matrimonio_consegna_foto before update of stato on public.matrimonio
  for each row execute function privato.segna_consegna_foto();
