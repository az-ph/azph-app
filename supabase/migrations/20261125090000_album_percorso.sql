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
