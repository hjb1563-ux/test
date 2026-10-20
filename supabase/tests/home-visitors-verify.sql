-- Read-only post-apply checks; never registers a visitor or changes permissions.
begin read only;
select current_setting('transaction_read_only') as read_only,
       current_database() as database_name,
       (clock_timestamp() at time zone 'Asia/Seoul')::date as seoul_day;
select n.nspname as schema_name, c.relname, c.relrowsecurity,
       pg_total_relation_size(c.oid) as bytes
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and (n.nspname = 'bath_metrics' or
 (n.nspname = 'public' and c.relname in ('projects','businesses','business_members')))
order by n.nspname, c.relname;
select n.nspname as schema_name, p.proname, p.prosecdef,
       p.provolatile, p.proconfig, pg_get_userbyid(p.proowner) as owner,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'bath_metrics' or
 (n.nspname = 'public' and p.proname in ('bath_visitor_today','bath_visitor_register'))
order by n.nspname, p.proname;
-- Expected for all metric tables: all direct privileges FALSE, even service_role.
-- Elevated private functions provide the narrowly-scoped writes instead.
select r.rolname, c.relname,
 has_table_privilege(r.rolname,c.oid,'select') as direct_select,
 has_table_privilege(r.rolname,c.oid,'insert') as direct_insert,
 has_table_privilege(r.rolname,c.oid,'update') as direct_update,
 has_table_privilege(r.rolname,c.oid,'delete') as direct_delete
from pg_roles r cross join pg_class c join pg_namespace n on n.oid=c.relnamespace
where r.rolname in ('anon','authenticated','service_role') and n.nspname='bath_metrics' and c.relkind='r'
order by r.rolname,c.relname;
select n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace
where n.nspname='bath_metrics' order by c.relname,con.conname;
select version,name from supabase_migrations.schema_migrations order by version;
select tablename,policyname,roles,cmd from pg_policies
where schemaname='public' and tablename in ('projects','businesses','business_members')
order by tablename,policyname;
commit;
