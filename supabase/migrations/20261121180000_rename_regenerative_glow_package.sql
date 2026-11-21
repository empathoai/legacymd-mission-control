-- 20261121180000_rename_regenerative_glow_package.sql
-- The active treatment lost the patient's name in 20261121170000, but the only line ever
-- sold for this protocol hangs on the inactive package `PCK-0012`, which still reads
-- "Regenerative Glow Protocol for Annette". So the screen the clinic reads would keep the
-- patient's name. Rename the package too.
--
-- The pair itself (a package with the one historical sale, an active unit row with none) is
-- the duplicate-row question that waits for the clinic: this migration changes no state
-- besides the name.

do $$
declare
  v_old constant text := 'Regenerative Glow Protocol for Annette';
  v_new constant text := 'Regenerative Glow Protocol';
  v_rows int;
begin
  update public.treatments
  set name = v_new
  where code = 'PCK-0012' and name = v_old;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'C: expected one row to rename, found %', v_rows;
  end if;

  if (
    select normalized_name from public.treatments where code = 'PCK-0012'
  ) is distinct from public.normalize_item_name(v_new) then
    raise exception 'C: normalized_name did not follow the rename';
  end if;

  if exists (select 1 from public.treatments where name ilike '%annette%') then
    raise exception 'C: a patient name is still in the catalog';
  end if;

  raise notice 'PCK-0012 renamed to %', v_new;
end $$;
