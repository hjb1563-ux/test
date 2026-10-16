-- OPERATOR ONLY, NOT a migration. No remote execution in Phase 2.6.
-- psql only (not SQL Editor). Use phase4a4-connection.mjs --fixture after approval.
-- Exact direct host OR Dashboard + live Management verified Session Pooler only.
-- Inputs are existing dedicated users and fresh UUID v4s from the local manifest.
-- Auth users must have trusted app_metadata.bath_rls_fixture = fixture_id.
-- See docs/PHASE2_6_RLS_RUNBOOK.md. No credentials belong in this file.
\set ON_ERROR_STOP on
-- Same physical psql session is checked before BEGIN / temporary tables / INSERT.
-- Missing wrapper attestation fails closed; do not hand-set its environment flags.
\ir phase4a4-connection-check.sql

begin;
select pg_advisory_xact_lock(hashtextextended('bath-phase2-fixture', 0));
create temporary table bath_fixture_users(actor text primary key, id uuid unique, anonymous boolean) on commit drop;
insert into bath_fixture_users values
 ('CUSTOMER_A',:'customer_a',true), ('CUSTOMER_B',:'customer_b',true),
 ('BUSINESS_A',:'business_a_user',false), ('BUSINESS_B',:'business_b_user',false),
 ('GENERAL',:'general_user',false), ('PENDING',:'pending_user',false);
create temporary table bath_fixture_businesses(id uuid primary key, business_name text, status text) on commit drop;
insert into bath_fixture_businesses values
 (:'business_a_id','BATH-RLS:' || :'fixture_id' || ':A','approved'),
 (:'business_b_id','BATH-RLS:' || :'fixture_id' || ':B','approved'),
 (:'suspended_business_id','BATH-RLS:' || :'fixture_id' || ':SUSPENDED','suspended');
create temporary table bath_fixture_members(id uuid primary key,business_id uuid,user_id uuid,role text,status text) on commit drop;
insert into bath_fixture_members values
 (:'member_a_id',:'business_a_id',:'business_a_user','member','approved'),
 (:'member_b_id',:'business_b_id',:'business_b_user','member','approved'),
 (:'pending_member_id',:'business_a_id',:'pending_user','member','pending'),
 (:'anonymous_member_id',:'business_a_id',:'customer_a','member','approved'),
 (:'suspended_member_id',:'suspended_business_id',:'business_a_user','member','approved'),
 (:'revoked_member_id',:'business_a_id',:'business_b_user','member','revoked');
select set_config('bath.fixture_id',:'fixture_id',true);
do $$
declare fixture text := current_setting('bath.fixture_id');
begin
  if fixture !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or exists (select 1 from (
      select id from bath_fixture_users union all select id from bath_fixture_businesses
      union all select id from bath_fixture_members union all select fixture::uuid
    ) ids group by id having count(*) > 1)
    or exists (select 1 from (
      select id from bath_fixture_users union all select id from bath_fixture_businesses union all select id from bath_fixture_members
    ) ids where id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') then
    raise exception 'Dedicated distinct UUID v4 values required';
  end if;
  if not exists (select 1 from pg_stat_ssl where pid = pg_backend_pid() and ssl) then
    raise exception 'TLS connection required';
  end if;
  if exists (
    select 1 from bath_fixture_users f left join auth.users u on u.id=f.id
    where u.id is null or u.raw_app_meta_data->>'bath_rls_fixture' is distinct from fixture
      or u.is_anonymous is distinct from f.anonymous
  ) then raise exception 'Dedicated existing Auth users / auth types do not match'; end if;
  -- A first setup must use accounts with NO pre-existing projects or foreign memberships.
  if exists (select 1 from public.projects p join bath_fixture_users u on u.id=p.owner_user_id)
    or exists (select 1 from public.business_members m join bath_fixture_users u on u.id=m.user_id
      where not exists (select 1 from bath_fixture_members f where f.id=m.id and f.business_id=m.business_id and f.user_id=m.user_id and f.role=m.role and f.status=m.status))
    or exists (select 1 from public.business_members m join bath_fixture_businesses b on b.id=m.business_id
      where not exists (select 1 from bath_fixture_members f where f.id=m.id and f.business_id=m.business_id and f.user_id=m.user_id and f.role=m.role and f.status=m.status))
    or exists (select 1 from public.businesses b join bath_fixture_businesses f on f.id=b.id
      where b.business_name is distinct from f.business_name or b.status is distinct from f.status)
    or exists (select 1 from public.business_members m join bath_fixture_members f on f.id=m.id
      where (m.business_id,m.user_id,m.role,m.status) is distinct from (f.business_id,f.user_id,f.role,f.status))
  then raise exception 'Fixture collision/drift/customer data: rollback, never overwrite'; end if;
end $$;
-- Exact existing fixtures are retained; changed/colliding records were rejected above.
insert into public.businesses(id,business_name,status)
select id,business_name,status from bath_fixture_businesses on conflict (id) do nothing;
insert into public.business_members(id,business_id,user_id,role,status)
select id,business_id,user_id,role,status from bath_fixture_members on conflict (id) do nothing;
commit;
