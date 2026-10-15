-- Builders Finance schema. Every row belongs to a business; every policy checks
-- membership through private.is_business_member().

create schema if not exists private;

-- Businesses and members ----------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index businesses_created_by_idx on public.businesses (created_by);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_id_idx on public.business_members (user_id);

-- Reference data ------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null check (length(btrim(name)) between 1 and 60),
  unique (business_id, kind, name),
  unique (id, kind, business_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  unique (id, business_id)
);
create unique index clients_business_id_lower_name_key on public.clients (business_id, lower(name));

-- Invoices ------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid not null,
  number text not null check (length(btrim(number)) between 1 and 30),
  issue_date date not null,
  due_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid')),
  paid_date date,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (business_id, number),
  unique (id, business_id),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade,
  check (due_date >= issue_date),
  check ((status = 'paid') = (paid_date is not null)),
  check (paid_date is null or paid_date >= issue_date)
);
create index invoices_business_status_due_idx on public.invoices (business_id, status, due_date);
create index invoices_client_id_idx on public.invoices (client_id);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  description text not null check (length(btrim(description)) between 1 and 200),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  position integer not null default 0,
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);
create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- Transactions --------------------------------------------------------------

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  date date not null,
  amount_cents bigint not null check (amount_cents > 0 and amount_cents <= 100000000000),
  category_id uuid not null,
  counterparty text not null check (length(btrim(counterparty)) between 1 and 120),
  note text check (note is null or length(note) <= 500),
  invoice_id uuid unique,
  created_at timestamptz not null default now(),
  foreign key (category_id, kind, business_id) references public.categories (id, kind, business_id) on delete cascade,
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade
);
create index transactions_business_date_idx on public.transactions (business_id, date);
create index transactions_category_id_idx on public.transactions (category_id);

-- Invoice totals are always calculated, never stored -----------------------

create view public.invoice_summaries with (security_invoker = true) as
select
  i.id,
  i.business_id,
  i.number,
  i.client_id,
  c.name as client_name,
  i.issue_date,
  i.due_date,
  i.status,
  i.paid_date,
  i.notes,
  coalesce(
    (select sum(round(it.quantity * it.unit_price_cents))::bigint
     from public.invoice_items it where it.invoice_id = i.id),
    0
  )::bigint as total_cents,
  case when i.status = 'sent' and i.due_date < current_date then 'overdue' else i.status end as display_status
from public.invoices i
join public.clients c on c.id = i.client_id;

-- Membership check used by every policy ------------------------------------

create function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_business_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_business_member(uuid) to authenticated;

-- Row level security --------------------------------------------------------

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.categories enable row level security;
alter table public.clients enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.transactions enable row level security;

create policy "Members and creators read the business" on public.businesses
  for select to authenticated
  using (private.is_business_member(id) or created_by = (select auth.uid()));
create policy "Users create businesses they own" on public.businesses
  for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Members update the business" on public.businesses
  for update to authenticated
  using (private.is_business_member(id))
  with check (private.is_business_member(id));

create policy "Users read their own memberships" on public.business_members
  for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Creators add themselves as owner" on public.business_members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and role = 'owner'
    and exists (select 1 from public.businesses b where b.id = business_id and b.created_by = (select auth.uid()))
  );

create policy "Members manage categories" on public.categories
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage clients" on public.clients
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage invoices" on public.invoices
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage invoice items" on public.invoice_items
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));
create policy "Members manage transactions" on public.transactions
  for all to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

-- Data API access. New tables are not exposed automatically, so grant exactly
-- what the app needs to signed-in (including anonymous) users, and nothing to anon.

revoke all on public.businesses, public.business_members, public.categories, public.clients,
  public.invoices, public.invoice_items, public.transactions, public.invoice_summaries from anon;
grant usage on schema public to authenticated;
grant select, insert, update on public.businesses to authenticated;
grant select, insert on public.business_members to authenticated;
grant select, insert, update, delete on public.categories, public.clients, public.invoices,
  public.invoice_items, public.transactions to authenticated;
grant select on public.invoice_summaries to authenticated;
