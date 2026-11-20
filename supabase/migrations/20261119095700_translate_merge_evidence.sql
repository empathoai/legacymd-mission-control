-- 095700_translate_merge_evidence.sql
-- One merge candidate kept a half-translated sentence. The source migration already
-- says "Same Weight Loss Package w/ Semaglutide"; this fixes the stored row.

update public.customer_merge_candidates
set evidence = 'Same Weight Loss Package w/ Semaglutide'
where evidence = 'Mismo Weight Loss Package w/ Semaglutide';
