-- Deletes anonymous visitors older than 7 days. Cascades remove their business
-- and every row in it. Runs nightly inside Postgres through pg_cron.

create extension if not exists pg_cron with schema pg_catalog;

create function private.delete_expired_sandboxes(p_max_age interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from auth.users
  where is_anonymous
    and created_at < now() - p_max_age;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function private.delete_expired_sandboxes(interval) from public;

select cron.schedule(
  'delete-expired-sandboxes',
  '0 3 * * *',
  $$ select private.delete_expired_sandboxes(); $$
);
