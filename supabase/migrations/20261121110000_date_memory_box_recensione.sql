-- Date di consegna della memory box e della recensione.
-- La spunta resta (dallo storico del foglio arrivano spunte senza data); la data implica la spunta.
alter table public.matrimonio
  add column memory_box_consegnata_il date,
  add column recensione_il date,
  add constraint memory_box_data_implica_spunta check (memory_box_consegnata_il is null or memory_box_consegnata),
  add constraint recensione_data_implica_spunta check (recensione_il is null or recensione_ricevuta);

-- La memory box si può segnare come consegnata solo se è nel pacchetto
-- (una riga "memory_box" in importo, anche a 0 come omaggio).
-- Controllo differito a fine transazione: l'importazione inserisce prima il matrimonio, poi gli importi.
create or replace function privato.controlla_memory_box(mid uuid)
returns void
language plpgsql
as $$
begin
  if exists (select 1 from public.matrimonio where id = mid and memory_box_consegnata)
     and not exists (select 1 from public.importo where matrimonio_id = mid and voce = 'memory_box') then
    raise exception 'La memory box non è nel pacchetto di questo Matrimonio: non può risultare consegnata';
  end if;
end;
$$;

create or replace function privato.verifica_memory_box_matrimonio()
returns trigger
language plpgsql
as $$
begin
  perform privato.controlla_memory_box(new.id);
  return null;
end;
$$;

create or replace function privato.verifica_memory_box_importo()
returns trigger
language plpgsql
as $$
begin
  perform privato.controlla_memory_box(old.matrimonio_id);
  return null;
end;
$$;

create constraint trigger memory_box_nel_pacchetto
  after insert or update of memory_box_consegnata on public.matrimonio
  deferrable initially deferred
  for each row execute function privato.verifica_memory_box_matrimonio();

create constraint trigger memory_box_tolta_dal_pacchetto
  after delete or update of voce on public.importo
  deferrable initially deferred
  for each row execute function privato.verifica_memory_box_importo();
