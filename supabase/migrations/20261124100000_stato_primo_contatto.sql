-- Nuovo stato tra "Da contattare" e "Preventivo": primo contatto fatto, preventivo non ancora inviato.
alter type public.stato_matrimonio add value if not exists 'qte_contatto' after 'qte_to_contact';
