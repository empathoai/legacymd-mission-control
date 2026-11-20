-- Control for C18: a closed month whose stored total drifted must be reported.
begin;

update public.expense_periods
set total = total + 1
where id = (
  select id from public.expense_periods
  where status = 'closed'
  order by period
  limit 1
);

select p.period,
       p.status,
       p.total,
       coalesce(sum(e.amount), 0) as entries_total
from public.expense_periods p
left join public.expense_entries e
  on e.period_id = p.id and e.voided_at is null
group by p.id, p.period, p.status, p.total, p.closed_at
having (p.status = 'closed' and p.total is distinct from coalesce(sum(e.amount), 0))
    or (p.status = 'open' and (p.total is not null or p.closed_at is not null));

rollback;
