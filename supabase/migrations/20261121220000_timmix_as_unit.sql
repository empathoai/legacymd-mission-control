-- 20261121220000_timmix_as_unit.sql
-- The owner's call: Male Optimization - Timmix is a unit treatment, not a package. That is
-- also where its history already lives — `TRT-0012` holds all 32 lines, and its catalog
-- price of 250 is the price 15 of them charged; `PCK-0017` is the package row with none.
-- So the unit becomes the live row and the package is retired.
--
-- Semaglutide needs no change: `TRT-0037` (unit, 13 lines) is already the active row and
-- `PCK-0015` (package) is already inactive. Tirzepatide keeps its package: `PCK-0016` holds
-- 186 lines and the owner has not asked for it.

do $$
declare
  v_on int;
  v_off int;
begin
  update public.treatments set active = true  where code = 'TRT-0012';
  get diagnostics v_on = row_count;
  update public.treatments set active = false where code = 'PCK-0017';
  get diagnostics v_off = row_count;

  if v_on <> 1 or v_off <> 1 then
    raise exception 'C: expected one row each, updated % and %', v_on, v_off;
  end if;

  if (
    select count(*) from public.treatments
    where name = 'Male Optimization - Timmix' and active
  ) <> 1 then
    raise exception 'C: Timmix must have exactly one active row';
  end if;

  if not exists (
    select 1 from public.treatments
    where code = 'TRT-0012' and unit_type = 'unit' and active and price = 250.00
  ) then
    raise exception 'C: the active Timmix row is not the unit at its price';
  end if;

  if (select active from public.treatments where code = 'PCK-0015') then
    raise exception 'C: the Semaglutide package should stay retired';
  end if;

  raise notice 'Timmix sells as the unit TRT-0012; PCK-0017 retired';
end $$;
