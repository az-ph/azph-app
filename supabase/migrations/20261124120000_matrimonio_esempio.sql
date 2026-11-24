-- Pagine di esempio (es. la proposta per una location): restano consultabili dal loro link,
-- ma non sono Matrimoni veri: fuori da elenchi, Oggi, numeri, controllo della data e calendario.
alter table public.matrimonio add column esempio boolean not null default false;
