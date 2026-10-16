-- Read-only, psql 15+. Also included BEFORE any Fixture transaction.
\set ON_ERROR_STOP on
\getenv verified_ref BATH_VERIFIED_REF
\getenv verified_host BATH_VERIFIED_HOST
\getenv verified_user BATH_VERIFIED_USER
\getenv SSL_MODE PGSSLMODE
\getenv SSL_CA PGSSLROOTCERT
select (
 :'project_ref' = 'istsrambmbzuemkgutgh' and :'project_name' = 'bath-designer-dev'
 and :'verified_ref' = :'project_ref' and :'HOST' = :'verified_host'
 and :'USER' = :'verified_user' and :'PORT' = '5432' and :'DBNAME' = 'postgres'
 and :'SSL_MODE' = 'verify-full' and length(:'SSL_CA') > 0
 and ((:'HOST' = 'db.istsrambmbzuemkgutgh.supabase.co' and :'USER' = 'postgres')
   or (:'HOST' = 'aws-0-ap-northeast-2.pooler.supabase.com'
       and :'USER' = 'postgres.istsrambmbzuemkgutgh'))
 and current_database() = 'postgres' and current_user = 'postgres' and session_user = 'postgres'
 and exists (select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl)
) as safe_connection \gset
\if :safe_connection
\else
 \echo 'STOP: verified development connection / TLS required'
 select 1/0;
\endif
with schema_state as (
select jsonb_build_object(
'columns',(select jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable,'default',column_default) order by table_name,ordinal_position) from information_schema.columns where table_schema='public' and table_name in ('projects','businesses','business_members')),
'constraints',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'name',conname,'definition',pg_get_constraintdef(oid)) order by conrelid::regclass::text,conname) from pg_constraint where conrelid in ('public.projects'::regclass,'public.businesses'::regclass,'public.business_members'::regclass)),
'policies',(select jsonb_agg(to_jsonb(p) order by tablename,policyname) from pg_policies p where schemaname='public' and tablename in ('projects','businesses','business_members')),
'triggers',(select jsonb_agg(pg_get_triggerdef(oid) order by tgname) from pg_trigger where not tgisinternal and tgrelid in ('public.projects'::regclass,'public.businesses'::regclass,'public.business_members'::regclass)),
'function',(select pg_get_functiondef('public.bath_phase2_before_update()'::regprocedure)),
'rls',(select jsonb_agg(jsonb_build_object('name',relname,'enabled',relrowsecurity) order by relname) from pg_class where oid in ('public.projects'::regclass,'public.businesses'::regclass,'public.business_members'::regclass)),
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name) order by version) from supabase_migrations.schema_migrations)
) as state)
select md5(state::text) = 'e8306b4873e2aa3c7aff1d7c12b9274e' as safe_schema from schema_state \gset
\if :safe_schema
\else
 \echo 'STOP: development migration/schema fingerprint differs; manual review required'
 select 1/0;
\endif
select json_build_object('bath_connection', json_build_object(
 'database',current_database(),'user',current_user,'session_user',session_user,
 'tls',(select ssl from pg_stat_ssl where pid=pg_backend_pid()),
 'migrations',(select json_agg(version order by version) from supabase_migrations.schema_migrations),
 'tables',(select json_agg(json_build_object('table',relname,'rls',relrowsecurity) order by relname)
 from pg_class where oid in ('public.projects'::regclass,'public.businesses'::regclass,'public.business_members'::regclass)),
 'rows',json_build_object('projects',(select count(*) from public.projects),
 'businesses',(select count(*) from public.businesses),'business_members',(select count(*) from public.business_members))
));

