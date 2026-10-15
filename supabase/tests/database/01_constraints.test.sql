begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Setup runs as postgres, which owns the tables, so RLS does not apply here.
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
insert into public.businesses (id, name, created_by)
values ('00000000-0000-4000-8000-0000000000a2', 'A Studio', '00000000-0000-4000-8000-0000000000a1');
insert into public.categories (id, business_id, kind, name) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2', 'expense', 'Rent'),
  ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000a2', 'income', 'Client payments');
insert into public.clients (id, business_id, name)
values ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a2', 'Northwind Cafe');
insert into public.invoices (id, business_id, client_id, number, issue_date, due_date, status)
values ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date - 40, current_date - 10, 'sent');
insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Design', 1.5, 3333, 0),
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Hosting', 1, 10000, 1);

select is(
  (select total_cents from public.invoice_summaries where id = '00000000-0000-4000-8000-0000000000a5'),
  15000::bigint,
  'invoice total rounds each line half away from zero, like the app'
);
select is(
  (select display_status from public.invoice_summaries where id = '00000000-0000-4000-8000-0000000000a5'),
  'overdue'::text,
  'a sent invoice past its due date shows as overdue'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 0, '00000000-0000-4000-8000-0000000000a3', 'X') $$,
  '23514', null, 'amounts must be above zero'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000a8', 'X') $$,
  '23503', null, 'an expense cannot use an income category'
);
select throws_ok(
  $$ insert into public.invoices (business_id, client_id, number, issue_date, due_date)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1002', current_date, current_date - 1) $$,
  '23514', null, 'a due date cannot come before the issue date'
);
select throws_ok(
  $$ update public.invoices set status = 'paid' where id = '00000000-0000-4000-8000-0000000000a5' $$,
  '23514', null, 'a paid invoice needs a payment date'
);
select throws_ok(
  $$ insert into public.invoices (business_id, client_id, number, issue_date, due_date)
     values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date, current_date) $$,
  '23505', null, 'invoice numbers are unique per business'
);
select throws_ok(
  $$ insert into public.clients (business_id, name) values ('00000000-0000-4000-8000-0000000000a2', 'northwind cafe') $$,
  '23505', null, 'client names are unique per business, ignoring case'
);
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint,
  'every table in public has RLS enabled'
);

select * from finish();
rollback;
