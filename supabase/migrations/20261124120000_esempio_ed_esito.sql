-- Pagine di esempio (es. la proposta per una location): restano consultabili dal loro link,
-- ma non sono Matrimoni veri: fuori da elenchi, Oggi, numeri, controllo della data e calendario.
alter table public.matrimonio add column esempio boolean not null default false;

-- Esito di un contatto: nessuna risposta, interessati, negativo (un esito negativo chiude il Matrimonio come Perso).
alter table public.contatto add column esito text check (esito in ('nessuna_risposta', 'positivo', 'negativo'));
