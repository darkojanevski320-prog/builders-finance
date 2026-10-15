begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', false, now(), now());
insert into public.businesses (id, name, created_by)
values ('00000000-0000-4000-8000-0000000000a2', 'A Studio', '00000000-0000-4000-8000-0000000000a1');
insert into public.business_members (business_id, user_id, role)
values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000a1', 'owner');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ update public.businesses set created_by = '00000000-0000-4000-8000-0000000000b1' where id = '00000000-0000-4000-8000-0000000000a2' $$,
  '42501', null, 'a member cannot reassign the business to another user and escape cleanup'
);
select lives_ok(
  $$ update public.businesses set name = 'Renamed Studio' where id = '00000000-0000-4000-8000-0000000000a2' $$,
  'a member can still rename the business'
);
select lives_ok(
  $$ insert into public.businesses (id, name, created_by) values ('00000000-0000-4000-8000-0000000000c3', 'Second', '00000000-0000-4000-8000-0000000000a1') $$,
  'setup: a second business row'
);
select throws_ok(
  $$ insert into public.business_members (business_id, user_id) values ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1') $$,
  '23505', null, 'a visitor can belong to only one business'
);

reset role;
select throws_ok(
  $$ insert into public.categories (business_id, kind, name)
     select '00000000-0000-4000-8000-0000000000a2', 'expense', 'Category ' || g from generate_series(1, 101) g $$,
  'P0001', 'row_limit_reached', 'a business cannot hold more than 100 categories'
);
select lives_ok(
  $$ insert into public.categories (business_id, kind, name)
     select '00000000-0000-4000-8000-0000000000a2', 'expense', 'Category ' || g from generate_series(1, 100) g $$,
  'a business can fill up to the limit'
);

select * from finish();
rollback;
