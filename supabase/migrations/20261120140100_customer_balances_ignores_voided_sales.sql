-- 20261120140100_customer_balances_ignores_voided_sales.sql
-- A sale with a plan and no receipts can be voided. Its pending installments stayed
-- in `next_due_on` and raised `is_overdue`, so the patient showed a debt for a sale
-- that no longer exists. `cash_expected` already ignored voided sales; the balance
-- view now does too.

create or replace view public.customer_balances with (security_invoker = true) as
 WITH sold AS (
         SELECT s.customer_id,
            sum(i.line_total) AS sold,
            count(DISTINCT s.occurred_on) AS visits,
            max(s.occurred_on) AS last_visit_on
           FROM (sales s
             JOIN sale_items i ON ((i.sale_id = s.id)))
          WHERE (s.voided_at IS NULL)
          GROUP BY s.customer_id
        ), collected AS (
         SELECT s.customer_id,
            sum(r.amount) AS collected
           FROM ((payment_receipts r
             JOIN sale_payments p ON ((p.id = r.sale_payment_id)))
             JOIN sales s ON ((s.id = p.sale_id)))
          WHERE (s.voided_at IS NULL)
          GROUP BY s.customer_id
        ), adjusted AS (
         SELECT a.customer_id,
            sum(a.revenue_delta) AS revenue_delta,
            sum(a.cash_delta) AS cash_delta
           FROM adjustments a
          WHERE (a.customer_id IS NOT NULL)
          GROUP BY a.customer_id
        ), owed_back AS (
         SELECT s.customer_id,
            sum(r.amount) AS pending_return
           FROM (sale_refunds r
             JOIN sales s ON ((s.id = r.sale_id)))
          WHERE (r.state = 'pending'::text)
          GROUP BY s.customer_id
        ), next_due AS (
         SELECT s.customer_id,
            min(p.due_on) AS next_due_on
           FROM (sale_payments p
             JOIN sales s ON ((s.id = p.sale_id)))
          WHERE ((p.status = 'pending'::text) AND (s.voided_at IS NULL) AND (p.due_on >= CURRENT_DATE) AND (p.amount > COALESCE(( SELECT sum(r.amount) AS sum
                   FROM payment_receipts r
                  WHERE (r.sale_payment_id = p.id)), (0)::numeric)))
          GROUP BY s.customer_id
        )
 SELECT c.id,
    c.full_name,
    (COALESCE(sd.sold, (0)::numeric))::numeric(12,2) AS sold_total,
    (COALESCE(co.collected, (0)::numeric))::numeric(12,2) AS collected_total,
    (COALESCE(ad.revenue_delta, (0)::numeric))::numeric(12,2) AS adjustment_revenue_total,
    (COALESCE(ad.cash_delta, (0)::numeric))::numeric(12,2) AS adjustment_cash_total,
    (COALESCE(ob.pending_return, (0)::numeric))::numeric(12,2) AS pending_return_total,
    (((((COALESCE(sd.sold, (0)::numeric) + COALESCE(ad.revenue_delta, (0)::numeric)) - COALESCE(ad.cash_delta, (0)::numeric)) - COALESCE(co.collected, (0)::numeric)) - COALESCE(ob.pending_return, (0)::numeric)))::numeric(12,2) AS balance,
    COALESCE(sd.visits, (0)::bigint) AS visits,
    sd.last_visit_on,
    nd.next_due_on,
    (((((COALESCE(sd.sold, (0)::numeric) + COALESCE(ad.revenue_delta, (0)::numeric)) - COALESCE(ad.cash_delta, (0)::numeric)) - COALESCE(co.collected, (0)::numeric)) - COALESCE(ob.pending_return, (0)::numeric)) <= (0)::numeric) AS is_settled,
    (EXISTS ( SELECT 1
           FROM (sale_payments p
             JOIN sales s ON ((s.id = p.sale_id)))
          WHERE ((s.customer_id = c.id) AND (s.voided_at IS NULL) AND (p.status = 'pending'::text) AND (p.due_on < CURRENT_DATE) AND (p.amount > COALESCE(( SELECT sum(r.amount) AS sum
                   FROM payment_receipts r
                  WHERE (r.sale_payment_id = p.id)), (0)::numeric))))) AS is_overdue
   FROM (((((customers c
     LEFT JOIN sold sd ON ((sd.customer_id = c.id)))
     LEFT JOIN collected co ON ((co.customer_id = c.id)))
     LEFT JOIN adjusted ad ON ((ad.customer_id = c.id)))
     LEFT JOIN owed_back ob ON ((ob.customer_id = c.id)))
     LEFT JOIN next_due nd ON ((nd.customer_id = c.id)))
  WHERE ((sd.customer_id IS NOT NULL) OR (co.customer_id IS NOT NULL) OR (ad.customer_id IS NOT NULL) OR (ob.customer_id IS NOT NULL));;

alter view public.customer_balances set (security_invoker = true);
