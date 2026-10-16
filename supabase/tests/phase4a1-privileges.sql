-- Read-only before/after validation. No SET ROLE or user requests.
-- Before approval: phase=before must match. After applying: phase=after must match.
with phases(phase,applied) as (values ('before',false),('after',true)),
roles(role_name) as (values ('anon'),('authenticated'),('service_role')),
tables(table_name) as (values ('projects'),('businesses'),('business_members')),
operations(privilege) as (values ('SELECT'),('INSERT'),('UPDATE'),('DELETE')),
project_updates(column_name) as (values
 ('project_info'),('builder_mode'),('selections'),
 ('consultation_memo'),('special_notes'),('current_step'),('consultation_checks'),
 ('image_history_order'),('content_modified_at'),('schema_version')),
member_updates(column_name) as (values ('role'),('status')),
table_results as (
 select p.phase,r.role_name,t.table_name,'(table)' as column_name,o.privilege,
 has_table_privilege(r.role_name,'public.'||t.table_name,o.privilege) as actual,
 case
 when r.role_name='service_role' then p.applied and o.privilege in ('SELECT','DELETE')
 when r.role_name='authenticated' then o.privilege='SELECT' or (t.table_name='projects' and o.privilege='DELETE')
 else false end as expected
 from phases p cross join roles r cross join tables t cross join operations o
),
column_results as (
 select p.phase,r.role_name,c.table_name,c.column_name,o.privilege,
 has_column_privilege(r.role_name,'public.'||c.table_name,c.column_name,o.privilege) as actual,
 case
 when r.role_name='service_role' then p.applied and (
   o.privilege='SELECT' or (o.privilege='UPDATE' and (
    (c.table_name='projects' and c.column_name in (select column_name from project_updates))
    or (c.table_name='business_members' and c.column_name in (select column_name from member_updates)))))
 when r.role_name='authenticated' then
   o.privilege='SELECT' or (c.table_name='projects' and (
    (o.privilege='INSERT' and c.column_name in ('id','owner_user_id','project_info','builder_mode','selections','consultation_memo','special_notes','current_step','consultation_checks','image_history_order','content_modified_at','schema_version'))
    or (o.privilege='UPDATE' and c.column_name in (select column_name from project_updates))))
 else false end as expected
 from phases p cross join roles r cross join information_schema.columns c
 cross join (values ('SELECT'),('INSERT'),('UPDATE')) o(privilege)
 where c.table_schema='public' and c.table_name in (select table_name from tables)
),
results as (select * from table_results union all select * from column_results)
select phase,count(*) as checked,count(*) filter(where actual=expected) as matched,
 bool_and(actual=expected) as all_match,
 coalesce(jsonb_agg(jsonb_build_object('role',role_name,'table',table_name,'column',column_name,
 'privilege',privilege,'expected',expected,'actual',actual)) filter(where actual is distinct from expected),'[]'::jsonb) as mismatches
from results group by phase order by phase;

