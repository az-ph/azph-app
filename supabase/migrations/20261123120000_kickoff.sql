-- Data del kick-off meeting: quando c'è, il Matrimonio esce dalla lista "Kick-off da fissare" della schermata Oggi.
alter table public.matrimonio add column kickoff_il date;
