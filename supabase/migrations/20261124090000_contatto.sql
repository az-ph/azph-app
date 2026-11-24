-- Contatti con gli Sposi segnati a mano dall'admin: invio del preventivo (anche di quelli mandati prima dell'app)
-- e follow-up (telefonate, WhatsApp, incontri), con l'eventuale data del prossimo follow-up.
create table public.contatto (
  id uuid primary key default gen_random_uuid(),
  matrimonio_id uuid not null references public.matrimonio(id) on delete cascade,
  tipo text not null check (tipo in ('invio', 'follow_up')),
  canale text not null check (canale in ('mail', 'whatsapp', 'telefono', 'persona', 'altro')),
  avvenuto_il timestamptz not null,
  nota text check (char_length(nota) <= 500),
  prossimo_il date,
  creato_il timestamptz not null default now()
);
create index contatto_matrimonio on public.contatto (matrimonio_id, avvenuto_il desc);

alter table public.contatto enable row level security;
grant select, insert, update, delete on public.contatto to authenticated;
create policy contatto_admin on public.contatto for all to authenticated
  using (privato.is_admin()) with check (privato.is_admin());
