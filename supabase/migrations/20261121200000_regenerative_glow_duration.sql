-- 20261121200000_regenerative_glow_duration.sql
-- The owner's answer: Regenerative Glow is a one-month protocol. It is a package now
-- (`20261121190000`), so the sale screen records the duration it carries. One month is the
-- number the owner gave; no other row is touched.

do $$
declare
  v_rows int;
begin
  update public.treatments
  set duration_months = 1
  where code = 'PCK-0012' and unit_type = 'package';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'C: expected one package to update, found %', v_rows;
  end if;

  if (select duration_months from public.treatments where code = 'PCK-0012') is distinct from 1 then
    raise exception 'C: the duration did not stick';
  end if;

  raise notice 'Regenerative Glow records a one-month duration';
end $$;
