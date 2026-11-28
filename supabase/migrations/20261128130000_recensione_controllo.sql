-- Richiesta della recensione (dall'app o segnata a mano in Oggi).
alter table public.matrimonio add column recensione_chiesta_il date;

-- Il controllo giornaliero (GitHub Action alle 6) gira con il service role e legge i dati di Oggi:
-- contatto era concessa solo all'admin. L'esito va in log_job (nome 'controllo_giornaliero'), solo codici e stati.
grant select on public.contatto to service_role;
