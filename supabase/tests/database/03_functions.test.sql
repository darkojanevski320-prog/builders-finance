begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());

select set_config('test.payload', $json$
{
  "name": "Northfield Studio",
  "categories": [
    {"key": "client-payments", "kind": "income", "name": "Client payments"},
    {"key": "rent", "kind": "expense", "name": "Rent"},
    {"key": "software", "kind": "expense", "name": "Software"}
  ],
  "clients": [{"key": "northwind", "name": "Northwind Cafe", "email": "billing.northwind-cafe@example.com"}],
  "invoices": [
    {"key": "inv-paid", "number": "INV-1001", "clientKey": "northwind", "issueDate": "2026-09-01", "dueDate": "2026-09-16",
     "status": "paid", "paidDate": "2026-09-10", "notes": null,
     "items": [{"description": "Website design", "quantity": 1, "unitPriceCents": 250000},
               {"description": "Copywriting", "quantity": 2, "unitPriceCents": 40000}]},
    {"key": "inv-draft", "number": "INV-1002", "clientKey": "northwind", "issueDate": "2026-10-01", "dueDate": "2026-10-31",
     "status": "draft", "paidDate": null, "notes": null,
     "items": [{"description": "Brand strategy", "quantity": 1, "unitPriceCents": 150000}]}
  ],
  "transactions": [
    {"kind": "income", "date": "2026-09-10", "amountCents": 330000, "categoryKey": "client-payments",
     "counterparty": "Northwind Cafe", "note": "Payment for INV-1001", "invoiceKey": "inv-paid"},
    {"kind": "expense", "date": "2026-09-01", "amountCents": 320000, "categoryKey": "rent",
     "counterparty": "Harborview Properties", "note": "Studio rent", "invoiceKey": null}
  ]
}
$json$, true);

-- Visitor C ------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
set local role authenticated;

select set_config('test.biz_c', public.create_business('C Studio')::text, true);
select is(public.create_business('Another name'), current_setting('test.biz_c')::uuid, 'create_business returns the existing business on a second call');
select is((select count(*) from public.business_members), 1::bigint, 'C is a member of exactly one business');

select lives_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$, 'load_sample_data loads the payload');
select is((select count(*) from public.categories), 3::bigint, 'categories loaded');
select is((select count(*) from public.clients), 1::bigint, 'clients loaded');
select is((select count(*) from public.invoices), 2::bigint, 'invoices loaded');
select is((select count(*) from public.invoice_items), 3::bigint, 'invoice items loaded');
select is((select count(*) from public.transactions), 2::bigint, 'transactions loaded');
select is((select name from public.businesses), 'Northfield Studio', 'the business takes the payload name');
select ok((select invoice_id is not null from public.transactions where kind = 'income'), 'the payment links to its invoice');

select lives_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$, 'loading again works');
select is((select count(*) from public.transactions), 2::bigint, 'loading again replaces rows instead of duplicating them');

select set_config('test.inv_new', public.create_invoice(current_setting('test.biz_c')::uuid, $json$
  {"clientName": "  northwind CAFE ", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "sent", "notes": "",
   "items": [{"description": "Design", "quantity": 1.5, "unitPriceCents": 3333},
             {"description": "Hosting", "quantity": 1, "unitPriceCents": 10000}]}
$json$::jsonb)::text, true);
select is((select number from public.invoices where id = current_setting('test.inv_new')::uuid), 'INV-1003', 'a new invoice takes the next number');
select is((select count(*) from public.clients), 1::bigint, 'a typed name matching an existing client reuses it');
select is((select total_cents from public.invoice_summaries where id = current_setting('test.inv_new')::uuid), 15000::bigint, '1.5 x 33.33 + 100.00 totals 150.00');
select is((select notes from public.invoices where id = current_setting('test.inv_new')::uuid), null::text, 'blank notes are stored as null');

select throws_ok($$ select public.create_invoice(current_setting('test.biz_c')::uuid,
  '{"clientName": "X", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "draft", "items": []}'::jsonb) $$,
  '22023', 'invoice_needs_items', 'an invoice needs at least one item');
select throws_ok($$ select public.create_invoice(current_setting('test.biz_c')::uuid,
  '{"clientName": "X", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "paid", "items": [{"description": "A", "quantity": 1, "unitPriceCents": 100}]}'::jsonb) $$,
  '22023', 'invalid_status', 'new invoices are draft or sent only');

select set_config('test.tx', public.mark_invoice_paid(current_setting('test.inv_new')::uuid, current_date)::text, true);
select is((select amount_cents from public.transactions where id = current_setting('test.tx')::uuid), 15000::bigint, 'the payment equals the invoice total');
select is((select status from public.invoices where id = current_setting('test.inv_new')::uuid), 'paid', 'the invoice is now paid');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_new')::uuid, current_date) $$,
  'P0001', 'invoice_already_paid', 'an invoice cannot be paid twice');
select throws_ok($$ select public.mark_invoice_paid((select id from public.invoices where number = 'INV-1002'), current_date) $$,
  'P0001', 'invoice_is_draft', 'a draft cannot be paid');

select set_config('test.inv_sent', public.create_invoice(current_setting('test.biz_c')::uuid, $json$
  {"clientName": "Harbor Books", "issueDate": "2026-10-01", "dueDate": "2026-10-31", "status": "sent",
   "items": [{"description": "Logo", "quantity": 1, "unitPriceCents": 90000}]}
$json$::jsonb)::text, true);
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, current_date + 1) $$,
  'P0001', 'paid_date_in_future', 'a payment date cannot be in the future');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, '2026-09-30') $$,
  'P0001', 'paid_date_before_issue', 'a payment date cannot be before the issue date');

-- Visitor D cannot touch C's business ---------------------------------------
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.load_sample_data(current_setting('test.biz_c')::uuid, current_setting('test.payload')::jsonb) $$,
  '42501', 'not_a_member', 'D cannot load data into C business');
select throws_ok($$ select public.mark_invoice_paid(current_setting('test.inv_sent')::uuid, current_date) $$,
  'P0002', 'invoice_not_found', 'D cannot pay C invoices');

select set_config('test.biz_d', public.create_business('D Studio')::text, true);
select set_config('test.inv_d', public.create_invoice(current_setting('test.biz_d')::uuid, $json$
  {"clientName": "Grove Fitness", "issueDate": "2026-10-01", "dueDate": "2026-10-16", "status": "sent",
   "items": [{"description": "Photography session", "quantity": 1, "unitPriceCents": 50000}]}
$json$::jsonb)::text, true);
select lives_ok($$ select public.mark_invoice_paid(current_setting('test.inv_d')::uuid, current_date) $$, 'D pays their own invoice');
select is((select count(*) from public.categories where kind = 'income' and name = 'Client payments'), 1::bigint,
  'paying creates the Client payments category when it is missing');

-- No session: anon cannot call the functions.
reset role;
set local role anon;
select throws_ok($$ select public.create_business('Anon') $$, '42501', null, 'anon cannot call create_business');
reset role;

select * from finish();
rollback;
