-- Area admin: la timeline si salva tutta insieme (testo → righe), in un'unica transazione.
create or replace function public.admin_salva_timeline(mid uuid, righe jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not privato.is_admin() then
    raise exception 'Solo l''admin con verifica in due passaggi';
  end if;
  delete from public.timeline where matrimonio_id = mid;
  insert into public.timeline (matrimonio_id, giorno, ordine, ora, fase, luogo, nota_privata)
  select mid, giorno, ordine, ora, fase, luogo, nota_privata
  from jsonb_to_recordset(coalesce(righe, '[]'::jsonb))
    as x(giorno smallint, ordine int, ora time, fase text, luogo text, nota_privata boolean);
end;
$$;
revoke all on function public.admin_salva_timeline(uuid, jsonb) from public, anon;
grant execute on function public.admin_salva_timeline(uuid, jsonb) to authenticated;
