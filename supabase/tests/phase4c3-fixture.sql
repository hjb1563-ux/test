-- Separate OPERATOR fixture, NOT a migration. Future approved Direct transport only.
-- manifest_json is non-secret UUID metadata; never pass passwords as -v arguments.
\set ON_ERROR_STOP on
\ir phase4a4-connection-check.sql
\getenv business_journal_ready BATH_BUSINESS_JOURNAL_READY
select (:'HOST'='db.istsrambmbzuemkgutgh.supabase.co' and :'USER'='postgres'
 and :'business_journal_ready'=(:'manifest_json'::jsonb->>'fixture_id')) as direct_journal_safe \gset
\if :direct_journal_safe
\else
 \echo 'STOP: verified Direct connection and durable business journal required'
 select 1/0;
\endif
begin;
select pg_advisory_xact_lock(hashtextextended('bath-phase4c3-fixture',0));
select set_config('bath.business_manifest',:'manifest_json',true);
do $$
declare
 m jsonb:=current_setting('bath.business_manifest')::jsonb;
 ids text[]; value text; actor text; fixture text:=m->>'fixture_id';
 business_row jsonb; member jsonb; bs jsonb; ms jsonb;
 marker text:='BATH-BUSINESS-RLS:'||(m->>'fixture_id');
begin
 if m->>'kind' is distinct from 'business-rls-v1' or m->>'project_ref' is distinct from 'istsrambmbzuemkgutgh'
   or jsonb_typeof(m->'users') is distinct from 'object'
   or (select array_agg(key order by key) from jsonb_object_keys(m->'users') key)
      is distinct from array['ANONYMOUS','BUSINESS_A','BUSINESS_B','GENERAL','PENDING']
   or (select array_agg(key order by key) from jsonb_object_keys(m->'businesses') key)
      is distinct from array['A','B','SUSPENDED']
   or (select array_agg(key order by key) from jsonb_object_keys(m->'members') key)
      is distinct from array['A','ANONYMOUS','B','PENDING','REVOKED','SUSPENDED']
 then raise exception 'Invalid business fixture manifest'; end if;
 ids:=array[fixture,m->>'project_id'];
 for value in select e.value from jsonb_each_text(m->'users') e loop ids:=array_append(ids,value);end loop;
 for value in select e.value from jsonb_each_text(m->'businesses') e loop ids:=array_append(ids,value);end loop;
 for value in select e.value from jsonb_each_text(m->'members') e loop ids:=array_append(ids,value);end loop;
 if cardinality(ids)<>16 or (select count(distinct x) from unnest(ids) x)<>16
   or exists(select 1 from unnest(ids) x where x is null or x!~*'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
 then raise exception 'Dedicated distinct UUID v4s required';end if;
 if not exists(select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
 then raise exception 'TLS backend required';end if;
 for actor,value in select e.key,e.value from jsonb_each_text(m->'users') e loop
  if not exists(select 1 from auth.users u where u.id=value::uuid
   and u.raw_app_meta_data->>'bath_business_rls_fixture'=fixture
   and u.is_anonymous=(actor='ANONYMOUS') and (actor='ANONYMOUS' or u.email_confirmed_at is not null))
  then raise exception 'Dedicated Auth identity/marker mismatch';end if;
 end loop;
 if exists(select 1 from public.projects p where p.id=any(ids::uuid[]) or p.owner_user_id in(select e.value::uuid from jsonb_each_text(m->'users') e))
 or exists(select 1 from public.businesses b where b.id=any(ids::uuid[]))
 or exists(select 1 from public.business_members bm where bm.id=any(ids::uuid[])
  or bm.user_id in(select e.value::uuid from jsonb_each_text(m->'users') e)
  or bm.business_id in(select e.value::uuid from jsonb_each_text(m->'businesses') e))
 then raise exception 'Fixture collision/pre-existing data; no overwrite or automatic retry';end if;
 bs:=jsonb_build_array(
  jsonb_build_object('id',m->'businesses'->>'A','business_name',marker||':A','status','approved'),
  jsonb_build_object('id',m->'businesses'->>'B','business_name',marker||':B','status','approved'),
  jsonb_build_object('id',m->'businesses'->>'SUSPENDED','business_name',marker||':SUSPENDED','status','suspended'));
 ms:=jsonb_build_array(
  jsonb_build_object('id',m->'members'->>'A','business_id',m->'businesses'->>'A','user_id',m->'users'->>'BUSINESS_A','status','approved'),
  jsonb_build_object('id',m->'members'->>'B','business_id',m->'businesses'->>'B','user_id',m->'users'->>'BUSINESS_B','status','approved'),
  jsonb_build_object('id',m->'members'->>'PENDING','business_id',m->'businesses'->>'A','user_id',m->'users'->>'PENDING','status','pending'),
  jsonb_build_object('id',m->'members'->>'ANONYMOUS','business_id',m->'businesses'->>'A','user_id',m->'users'->>'ANONYMOUS','status','approved'),
  jsonb_build_object('id',m->'members'->>'SUSPENDED','business_id',m->'businesses'->>'SUSPENDED','user_id',m->'users'->>'BUSINESS_A','status','approved'),
  jsonb_build_object('id',m->'members'->>'REVOKED','business_id',m->'businesses'->>'A','user_id',m->'users'->>'BUSINESS_B','status','revoked'));
 for business_row in select x from jsonb_array_elements(bs) x loop
  insert into public.businesses(id,business_name,status) values((business_row->>'id')::uuid,business_row->>'business_name',business_row->>'status');
 end loop;
 for member in select x from jsonb_array_elements(ms) x loop
  insert into public.business_members(id,business_id,user_id,role,status)
  values((member->>'id')::uuid,(member->>'business_id')::uuid,(member->>'user_id')::uuid,'member',member->>'status');
 end loop;
 insert into public.projects(id,owner_user_id,project_info,selections,schema_version)
 values((m->>'project_id')::uuid,(m->'users'->>'ANONYMOUS')::uuid,
  jsonb_build_object('builderMode','consumer','projectName',marker||':PROJECT'),'{}'::jsonb,3);
end $$;
commit;
