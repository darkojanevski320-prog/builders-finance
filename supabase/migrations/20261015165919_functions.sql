-- Multi-row operations. All run as the caller (security invoker), so RLS still
-- applies; each checks membership first and runs as one transaction.

create function public.create_business(p_name text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then
    raise exception using message = 'not_authenticated', errcode = '28000';
  end if;

  -- One business per visitor in version 1. A double click returns the same one.
  select m.business_id into v_id from public.business_members m where m.user_id = v_user limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.businesses (name, created_by) values (p_name, v_user) returning id into v_id;
  insert into public.business_members (business_id, user_id, role) values (v_id, v_user, 'owner');
  return v_id;
end;
$$;

create function public.load_sample_data(p_business_id uuid, p_data jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_categories jsonb;
  v_clients jsonb;
  v_invoices jsonb;
begin
  if not private.is_business_member(p_business_id) then
    raise exception using message = 'not_a_member', errcode = '42501';
  end if;

  delete from public.transactions where business_id = p_business_id;
  delete from public.invoices where business_id = p_business_id;
  delete from public.clients where business_id = p_business_id;
  delete from public.categories where business_id = p_business_id;

  update public.businesses set name = coalesce(p_data ->> 'name', name) where id = p_business_id;

  with src as materialized (
    select gen_random_uuid() as id, x.key, x.kind, x.name
    from jsonb_to_recordset(p_data -> 'categories') as x(key text, kind text, name text)
  ), ins as (
    insert into public.categories (id, business_id, kind, name)
    select id, p_business_id, kind, name from src
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_categories from src;

  with src as materialized (
    select gen_random_uuid() as id, x.key, x.name, x.email
    from jsonb_to_recordset(p_data -> 'clients') as x(key text, name text, email text)
  ), ins as (
    insert into public.clients (id, business_id, name, email)
    select id, p_business_id, name, email from src
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_clients from src;

  with src as materialized (
    select gen_random_uuid() as id, x.*
    from jsonb_to_recordset(p_data -> 'invoices') as x(
      key text, number text, "clientKey" text, "issueDate" date, "dueDate" date,
      status text, "paidDate" date, notes text, items jsonb
    )
  ), ins as (
    insert into public.invoices (id, business_id, client_id, number, issue_date, due_date, status, paid_date, notes)
    select id, p_business_id, (v_clients ->> "clientKey")::uuid, number, "issueDate", "dueDate", status, "paidDate", notes
    from src
  ), item_ins as (
    insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position)
    select src.id, p_business_id, e.item ->> 'description', (e.item ->> 'quantity')::numeric,
           (e.item ->> 'unitPriceCents')::bigint, (e.ord - 1)::integer
    from src cross join lateral jsonb_array_elements(src.items) with ordinality as e(item, ord)
  )
  select coalesce(jsonb_object_agg(key, id), '{}'::jsonb) into v_invoices from src;

  insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty, note, invoice_id)
  select p_business_id, x.kind, x.date, x."amountCents", (v_categories ->> x."categoryKey")::uuid,
         x.counterparty, x.note, (v_invoices ->> x."invoiceKey")::uuid
  from jsonb_to_recordset(p_data -> 'transactions') as x(
    kind text, date date, "amountCents" bigint, "categoryKey" text, counterparty text, note text, "invoiceKey" text
  );
end;
$$;

create function public.create_invoice(p_business_id uuid, p_data jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_client_name text := btrim(coalesce(p_data ->> 'clientName', ''));
  v_status text := coalesce(p_data ->> 'status', 'draft');
  v_client_id uuid;
  v_invoice_id uuid;
  v_next integer;
begin
  if not private.is_business_member(p_business_id) then
    raise exception using message = 'not_a_member', errcode = '42501';
  end if;
  if v_client_name = '' then
    raise exception using message = 'client_required', errcode = '22023';
  end if;
  if jsonb_typeof(p_data -> 'items') is distinct from 'array' or jsonb_array_length(p_data -> 'items') = 0 then
    raise exception using message = 'invoice_needs_items', errcode = '22023';
  end if;
  if v_status not in ('draft', 'sent') then
    raise exception using message = 'invalid_status', errcode = '22023';
  end if;

  -- Lock the business row so two invoices created at once get different numbers.
  perform 1 from public.businesses where id = p_business_id for update;

  select c.id into v_client_id
  from public.clients c
  where c.business_id = p_business_id and lower(c.name) = lower(v_client_name)
  limit 1;
  if v_client_id is null then
    insert into public.clients (business_id, name) values (p_business_id, v_client_name) returning id into v_client_id;
  end if;

  select coalesce(max(substring(i.number from '^INV-(\d+)$')::integer), 1000) + 1 into v_next
  from public.invoices i where i.business_id = p_business_id;

  insert into public.invoices (business_id, client_id, number, issue_date, due_date, status, notes)
  values (
    p_business_id, v_client_id, 'INV-' || v_next, (p_data ->> 'issueDate')::date, (p_data ->> 'dueDate')::date,
    v_status, nullif(btrim(coalesce(p_data ->> 'notes', '')), '')
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (invoice_id, business_id, description, quantity, unit_price_cents, position)
  select v_invoice_id, p_business_id, e.item ->> 'description', (e.item ->> 'quantity')::numeric,
         (e.item ->> 'unitPriceCents')::bigint, (e.ord - 1)::integer
  from jsonb_array_elements(p_data -> 'items') with ordinality as e(item, ord);

  return v_invoice_id;
end;
$$;

create function public.mark_invoice_paid(p_invoice_id uuid, p_paid_date date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invoice record;
  v_category_id uuid;
  v_total bigint;
  v_transaction_id uuid;
begin
  -- RLS hides other businesses' invoices, so a non-member gets "not found".
  select i.id, i.business_id, i.number, i.status, i.issue_date, c.name as client_name
  into v_invoice
  from public.invoices i
  join public.clients c on c.id = i.client_id
  where i.id = p_invoice_id
  for update of i;

  if not found then
    raise exception using message = 'invoice_not_found', errcode = 'P0002';
  end if;
  if v_invoice.status = 'paid' then
    raise exception using message = 'invoice_already_paid', errcode = 'P0001';
  end if;
  if v_invoice.status = 'draft' then
    raise exception using message = 'invoice_is_draft', errcode = 'P0001';
  end if;
  if p_paid_date > current_date then
    raise exception using message = 'paid_date_in_future', errcode = 'P0001';
  end if;
  if p_paid_date < v_invoice.issue_date then
    raise exception using message = 'paid_date_before_issue', errcode = 'P0001';
  end if;

  select coalesce(sum(round(it.quantity * it.unit_price_cents)), 0)::bigint into v_total
  from public.invoice_items it where it.invoice_id = p_invoice_id;
  if v_total <= 0 then
    raise exception using message = 'invoice_total_zero', errcode = 'P0001';
  end if;

  select id into v_category_id
  from public.categories
  where business_id = v_invoice.business_id and kind = 'income' and name = 'Client payments';
  if v_category_id is null then
    insert into public.categories (business_id, kind, name)
    values (v_invoice.business_id, 'income', 'Client payments')
    returning id into v_category_id;
  end if;

  update public.invoices set status = 'paid', paid_date = p_paid_date where id = p_invoice_id;

  insert into public.transactions (business_id, kind, date, amount_cents, category_id, counterparty, note, invoice_id)
  values (v_invoice.business_id, 'income', p_paid_date, v_total, v_category_id, v_invoice.client_name,
          'Payment for ' || v_invoice.number, p_invoice_id)
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.create_business(text) from public, anon;
revoke execute on function public.load_sample_data(uuid, jsonb) from public, anon;
revoke execute on function public.create_invoice(uuid, jsonb) from public, anon;
revoke execute on function public.mark_invoice_paid(uuid, date) from public, anon;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.load_sample_data(uuid, jsonb) to authenticated;
grant execute on function public.create_invoice(uuid, jsonb) to authenticated;
grant execute on function public.mark_invoice_paid(uuid, date) to authenticated;
