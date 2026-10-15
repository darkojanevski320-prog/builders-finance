-- Hardening after the version 1 review.
-- 1. Grant exactly what the app needs. businesses.created_by must never change, or a
--    sandbox could be reassigned and escape the nightly cleanup.
-- 2. One membership per visitor.
-- 3. Per-business row limits, so one visitor cannot fill the database.

revoke all on public.businesses, public.business_members, public.categories, public.clients,
  public.invoices, public.invoice_items, public.transactions, public.invoice_summaries from authenticated;
grant select, insert on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;
grant select, insert on public.business_members to authenticated;
grant select, insert, update, delete on public.categories, public.clients, public.invoices,
  public.invoice_items, public.transactions to authenticated;
grant select on public.invoice_summaries to authenticated;

drop index if exists public.business_members_user_id_idx;
create unique index business_members_user_id_key on public.business_members (user_id);

create function private.enforce_business_row_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_over boolean := false;
begin
  if tg_table_name = 'categories' then
    select exists (select 1 from (select distinct business_id from new_rows) n
      where (select count(*) from public.categories t where t.business_id = n.business_id) > v_limit) into v_over;
  elsif tg_table_name = 'clients' then
    select exists (select 1 from (select distinct business_id from new_rows) n
      where (select count(*) from public.clients t where t.business_id = n.business_id) > v_limit) into v_over;
  elsif tg_table_name = 'invoices' then
    select exists (select 1 from (select distinct business_id from new_rows) n
      where (select count(*) from public.invoices t where t.business_id = n.business_id) > v_limit) into v_over;
  elsif tg_table_name = 'invoice_items' then
    select exists (select 1 from (select distinct business_id from new_rows) n
      where (select count(*) from public.invoice_items t where t.business_id = n.business_id) > v_limit) into v_over;
  elsif tg_table_name = 'transactions' then
    select exists (select 1 from (select distinct business_id from new_rows) n
      where (select count(*) from public.transactions t where t.business_id = n.business_id) > v_limit) into v_over;
  end if;

  if v_over then
    raise exception using message = 'row_limit_reached', errcode = 'P0001';
  end if;
  return null;
end;
$$;
revoke all on function private.enforce_business_row_limit() from public;

-- Sample data uses about 12 categories, 14 clients, 200 invoices, 400 items, and 550 transactions.
create trigger categories_row_limit after insert on public.categories
  referencing new table as new_rows for each statement execute function private.enforce_business_row_limit('100');
create trigger clients_row_limit after insert on public.clients
  referencing new table as new_rows for each statement execute function private.enforce_business_row_limit('500');
create trigger invoices_row_limit after insert on public.invoices
  referencing new table as new_rows for each statement execute function private.enforce_business_row_limit('1000');
create trigger invoice_items_row_limit after insert on public.invoice_items
  referencing new table as new_rows for each statement execute function private.enforce_business_row_limit('5000');
create trigger transactions_row_limit after insert on public.transactions
  referencing new table as new_rows for each statement execute function private.enforce_business_row_limit('5000');
