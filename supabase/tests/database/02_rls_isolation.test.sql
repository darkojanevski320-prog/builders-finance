begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- Two visitors, A and B, each with a full business. Setup runs as postgres.
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
insert into public.businesses (id, name, created_by) values
  ('00000000-0000-4000-8000-0000000000a2', 'A Studio', '00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2', 'B Studio', '00000000-0000-4000-8000-0000000000b1');
insert into public.business_members (business_id, user_id, role) values
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'owner'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b1', 'owner');
insert into public.categories (id, business_id, kind, name) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000a2', 'expense', 'Rent'),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000b2', 'expense', 'Rent');
insert into public.clients (id, business_id, name) values
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-0000000000a2', 'Client A'),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000b2', 'Client B');
insert into public.invoices (id, business_id, client_id, number, issue_date, due_date) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a4', 'INV-1001', current_date, current_date + 30),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000b4', 'INV-1001', current_date, current_date + 30);
insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents) values
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-0000000000a2', 'Work', 1, 5000),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000b2', 'Work', 1, 5000);
insert into public.transactions (id, business_id, kind, date, amount_cents, category_id, counterparty) values
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000a3', 'Landlord'),
  ('00000000-0000-4000-8000-0000000000b7', '00000000-0000-4000-8000-0000000000b2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000b3', 'Landlord');

-- Act as visitor A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select results_eq($$ select count(*) from public.businesses $$, $$ values (1::bigint) $$, 'A sees only their business');
select results_eq($$ select count(*) from public.business_members $$, $$ values (1::bigint) $$, 'A sees only their membership');
select results_eq($$ select count(*) from public.categories $$, $$ values (1::bigint) $$, 'A sees only their categories');
select results_eq($$ select count(*) from public.clients $$, $$ values (1::bigint) $$, 'A sees only their clients');
select results_eq($$ select count(*) from public.invoices $$, $$ values (1::bigint) $$, 'A sees only their invoices');
select results_eq($$ select count(*) from public.invoice_items $$, $$ values (1::bigint) $$, 'A sees only their invoice items');
select results_eq($$ select count(*) from public.transactions $$, $$ values (1::bigint) $$, 'A sees only their transactions');
select results_eq($$ select count(*) from public.invoice_summaries $$, $$ values (1::bigint) $$, 'the view applies the same rules');

select is_empty($$ update public.categories set name = 'Taken' where business_id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot update B categories');
select is_empty($$ delete from public.transactions where business_id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot delete B transactions');
select is_empty($$ update public.businesses set name = 'Taken' where id = '00000000-0000-4000-8000-0000000000b2' returning 1 $$, 'A cannot rename B business');

select throws_ok(
  $$ insert into public.categories (business_id, kind, name) values ('00000000-0000-4000-8000-0000000000b2', 'expense', 'Sneaky') $$,
  '42501', null, 'A cannot insert into B business'
);
select throws_ok(
  $$ insert into public.business_members (business_id, user_id) values ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1') $$,
  '42501', null, 'A cannot join B business'
);
select throws_ok(
  $$ insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty)
     values ('00000000-0000-4000-8000-0000000000a2', 'expense', current_date, 100, '00000000-0000-4000-8000-0000000000b3', 'X') $$,
  '23503', null, 'A cannot use a B category inside their own business'
);
select throws_ok(
  $$ update public.transactions set business_id = '00000000-0000-4000-8000-0000000000b2' where id = '00000000-0000-4000-8000-0000000000a7' $$,
  '42501', null, 'A cannot move a row into B business'
);
select lives_ok(
  $$ insert into public.categories (business_id, kind, name) values ('00000000-0000-4000-8000-0000000000a2', 'expense', 'Travel') $$,
  'A can add rows to their own business'
);

-- A request with no session uses the anon role, which has no table access.
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.transactions $$, '42501', null, 'anon cannot read transactions');
reset role;

select * from finish();
rollback;
