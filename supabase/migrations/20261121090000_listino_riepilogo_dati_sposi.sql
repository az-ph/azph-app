-- Listino: voce di riepilogo degli importi (era COLONNA APERTI: servizio, memory_box, secondo_operatore, album…).
alter table public.voce_listino add column riepilogo text;

comment on column public.voce_listino.solo_se is
  'Condizioni sulle opzioni del preventivo, separate da virgola; "!" nega. Es. "proponi_op2_ibrido,!proponi_video".';
comment on column public.preventivo.opzioni is
  'Opzioni proposte: {"proponi_video": bool, "proponi_prewedding": bool, "proponi_op2_ibrido": bool}';

-- Sposi: dati raccolti oggi dal form della pagina (servono a contratto e fattura).
alter table public.sposo
  add column codice_fiscale text,
  add column indirizzo text,
  add column indirizzo_preparativi text;

comment on column public.sposo.indirizzo_preparativi is 'Facoltativo: dove si svolgono i preparativi.';
