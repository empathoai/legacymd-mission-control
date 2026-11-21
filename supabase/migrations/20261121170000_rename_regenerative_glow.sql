-- 20261121170000_rename_regenerative_glow.sql
-- The item was registered as "Regenerative Glow Protocol for Annette": a patient's name
-- inside the catalog. The catalog is the clinic's definition, not a patient's file, and a
-- name that carries a person cannot be sold to the next one without looking wrong.
--
-- Only the active treatment is renamed. `PCK-0012` is an inactive package with the same
-- patient name and one historical line; it belongs to the duplicate-row question, not here.

do $$
declare
  v_old constant text := 'Regenerative Glow Protocol for Annette';
  v_new constant text := 'Regenerative Glow Protocol';
  v_rows int;
begin
  update public.treatments
  set name = v_new
  where code = 'TRT-0035' and name = v_old;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'C: expected one row to rename, found %', v_rows;
  end if;

  if exists (
    select 1 from public.treatments where name = v_new and code <> 'TRT-0035'
  ) then
    raise exception 'C: % is already taken in treatments', v_new;
  end if;

  if (
    select normalized_name from public.treatments where code = 'TRT-0035'
  ) is distinct from public.normalize_item_name(v_new) then
    raise exception 'C: normalized_name did not follow the rename';
  end if;

  raise notice 'TRT-0035 renamed to %', v_new;
end $$;
