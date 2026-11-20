-- 20261119093000_balance_comment_adjustments.sql
-- 092700 said adjustments would have to be subtracted in the balance. That is
-- wrong for a refund that already moved cash: it lowers revenue and cash by the
-- same amount, so sold - paid does not move at all. Only an adjustment still
-- pending (money the clinic owes back) changes the balance, and that needs a
-- status column the future adjustments table does not have yet.
--
-- This file only corrects the comment; the view definition is unchanged.

comment on view public.customer_balances is
  'Per customer: sold, paid, balance (sold - paid, positive means owed), pending schedule, next due date, visits and last visit. is_overdue means a pending payment is past its due date. Customers with no visits have all zeros and count as settled: nothing is owed.';

comment on column public.customer_balances.balance is
  'sold_total - paid_total. Positive means the customer owes money. A refund that already moved cash lowers revenue and cash equally, so it does not change this figure; a refund still owed would.';
