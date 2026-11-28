-- Appuntamento fissato durante un contatto (chiamata, videochiamata, incontro): crea l'evento [FCO] nel calendario.
alter table public.contatto
  add column appuntamento_il timestamptz,
  add column appuntamento_evento text check (char_length(appuntamento_evento) <= 200);
