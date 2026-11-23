-- Kick-off meeting: data e ora (quando c'è, il Matrimonio esce da "Kick-off da fissare" nella schermata Oggi)
-- e id dell'evento [KOM] creato nel calendario del titolare, per spostarlo o toglierlo.
alter table public.matrimonio add column kickoff_il timestamptz, add column kickoff_evento text;
