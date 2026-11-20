-- L'admin è riconosciuto solo dopo il secondo fattore (aal2).
-- Con la sola password il database non restituisce nulla.
create or replace function privato.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'ruolo') = 'admin'
    and (auth.jwt() ->> 'aal') = 'aal2',
    false
  )
$$;
