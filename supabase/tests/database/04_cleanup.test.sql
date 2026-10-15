begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  now() - interval '8 days', now()),
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true,  now() - interval '1 day', now()),
  ('00000000-0000-4000-8000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, now() - interval '30 days', now());
insert into public.businesses (id, name, created_by) values
  ('00000000-0000-4000-8000-0000000000e2', 'Old sandbox', '00000000-0000-4000-8000-0000000000e1'),
  ('00000000-0000-4000-8000-0000000000f2', 'New sandbox', '00000000-0000-4000-8000-0000000000f1'),
  ('00000000-0000-4000-8000-0000000000a8', 'Real account', '00000000-0000-4000-8000-0000000000a9');
insert into public.categories (business_id, kind, name)
values ('00000000-0000-4000-8000-0000000000e2', 'expense', 'Rent');

-- The local database may hold other old dev sandboxes, so expect at least one.
select ok(private.delete_expired_sandboxes() >= 1, 'deletes expired anonymous users');
select is_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000e2' $$, 'the expired sandbox business is gone');
select is_empty($$ select 1 from public.categories where business_id = '00000000-0000-4000-8000-0000000000e2' $$, 'its rows are gone');
select isnt_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000f2' $$, 'a recent sandbox stays');
select isnt_empty($$ select 1 from public.businesses where id = '00000000-0000-4000-8000-0000000000a8' $$, 'non-anonymous users are never deleted');
select isnt_empty(
  $$ select 1 from cron.job where jobname = 'delete-expired-sandboxes' and schedule = '0 3 * * *' $$,
  'the nightly job runs at 03:00 UTC'
);

select * from finish();
rollback;
