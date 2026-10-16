-- Offline draft. Apply once through migration history; never blindly rerun.
-- Transaction rolls back on conflicts instead of hiding schema drift with IF NOT EXISTS.
begin;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_info jsonb not null default '{"builderMode":"consumer"}'::jsonb,
  builder_mode text not null default 'consumer' check (builder_mode in ('consumer','professional')),
  selections jsonb not null default '{}'::jsonb check (jsonb_typeof(selections) = 'object'),
  consultation_memo text not null default '',
  special_notes text not null default '' check (char_length(special_notes) <= 500),
  current_step integer not null default 0 check (current_step between 0 and 15),
  consultation_checks jsonb not null default '{}'::jsonb check (jsonb_typeof(consultation_checks) = 'object'),
  image_history_order jsonb not null default '[]'::jsonb check (jsonb_typeof(image_history_order) = 'array'),
  content_modified_at timestamptz,
  schema_version integer not null default 3 check (schema_version = 3),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Preserve the minimal DEFAULT and empty local drafts. Known optional fields
  -- may be absent; if present, they must match the existing ProjectInfo types.
  -- Names, dates, money ranges and unknown-key semantics remain server validation.
  constraint projects_project_info_types check ((
    jsonb_typeof(project_info->'builderMode') = 'string'
    and (not (project_info ? 'customerName') or jsonb_typeof(project_info->'customerName') = 'string')
    and (not (project_info ? 'projectName') or jsonb_typeof(project_info->'projectName') = 'string')
    and (not (project_info ? 'areaPyeong') or jsonb_typeof(project_info->'areaPyeong') = 'string')
    and (not (project_info ? 'constructionDate') or jsonb_typeof(project_info->'constructionDate') in ('string','null'))
    and (not (project_info ? 'budget') or jsonb_typeof(project_info->'budget') in ('number','null'))
    and (not (project_info ? 'propertyType') or (
      jsonb_typeof(project_info->'propertyType') = 'null'
      or (jsonb_typeof(project_info->'propertyType') = 'string' and project_info->>'propertyType' in ('아파트','빌라','상가'))
    ))
    and (not (project_info ? 'occupancyStatus') or (
      jsonb_typeof(project_info->'occupancyStatus') = 'null'
      or (jsonb_typeof(project_info->'occupancyStatus') = 'string' and project_info->>'occupancyStatus' in ('살고 있다','이사갈 곳이다'))
    ))
  ) is true),
  -- UTF-8 bytes of PostgreSQL's JSONB text, including keys/JSON punctuation.
  -- These are per-column limits, not request-body or whole-row limits.
  -- Memo is a character limit (not JS UTF-16 units); Korean text is not penalized.
  constraint projects_consultation_memo_length check (char_length(consultation_memo) <= 65536),
  constraint projects_consultation_checks_size check (octet_length(convert_to(consultation_checks::text, 'UTF8')) <= 65536),
  constraint projects_image_history_order_size check (octet_length(convert_to(image_history_order::text, 'UTF8')) <= 65536),
  -- Strict mode rejects nested arrays instead of unwrapping them into strings.
  -- Guard the wildcard and fail closed on UNKNOWN; empty arrays remain valid.
  constraint projects_image_history_order_element_types check ((case
    when jsonb_typeof(image_history_order) = 'array' then
      not jsonb_path_exists(image_history_order, 'strict $[*] ? (@.type() != "string")')
    else false
  end) is true),
  constraint projects_project_info_size check (octet_length(convert_to(project_info::text, 'UTF8')) <= 65536),
  constraint projects_selections_size check (octet_length(convert_to(selections::text, 'UTF8')) <= 524288),
  -- Strict JSONPath avoids lax array unwrapping: nested arrays are invalid.
  -- CASE guards the object wildcard; IS TRUE makes UNKNOWN fail closed.
  -- Empty strings/arrays and all group/option IDs remain allowed.
  constraint projects_selections_value_types check ((case
    when jsonb_typeof(selections) = 'object' then
      not jsonb_path_exists(selections, 'strict $.* ? (@.type() != "string" && @.type() != "array")')
      and not jsonb_path_exists(selections, 'strict $.* ? (@.type() == "array")[*] ? (@.type() != "string")')
    else false
  end) is true),
  constraint project_info_mode check (
    jsonb_typeof(project_info) = 'object' and project_info ? 'builderMode'
    and project_info->>'builderMode' is not null
    and project_info->>'builderMode' = builder_mode
  )
);
create index projects_owner_updated_idx on public.projects(owner_user_id, updated_at desc);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  business_name text not null check (char_length(btrim(business_name)) between 1 and 200),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'pending' check (status in ('pending','approved','revoked')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_members_user_business_idx on public.business_members(user_id, business_id) where status = 'approved';

-- Invoker trigger only: no elevated functions or callable membership bypass.
create function public.bath_phase2_before_update() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'Immutable identity fields' using errcode = '42501';
  end if;
  if tg_table_name = 'projects' then
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Project ownership is immutable' using errcode = '42501';
    end if;
    new.revision := old.revision + 1;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.bath_phase2_before_update() from public, anon, authenticated;
create trigger projects_before_update before update on public.projects for each row execute function public.bath_phase2_before_update();
create trigger businesses_before_update before update on public.businesses for each row execute function public.bath_phase2_before_update();

alter table public.projects enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;

-- Anonymous Auth users may keep their own projects; signed-out anon has no grants.
create policy projects_select_own on public.projects for select to authenticated using (owner_user_id = (select auth.uid()));
create policy projects_insert_own on public.projects for insert to authenticated with check (owner_user_id = (select auth.uid()));
create policy projects_update_own on public.projects for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy projects_delete_own on public.projects for delete to authenticated using (owner_user_id = (select auth.uid()));

-- Fail closed when is_anonymous is absent. Only the user's own approved membership
-- is visible. This policy does not query businesses, so the graph is acyclic.
create policy business_members_select_self on public.business_members for select to authenticated
using (user_id = (select auth.uid()) and status = 'approved' and (select auth.jwt()->>'is_anonymous') = 'false');
create policy businesses_select_approved_member on public.businesses for select to authenticated
using (status = 'approved' and (select auth.jwt()->>'is_anonymous') = 'false'
  and exists (select 1 from public.business_members m where m.business_id = businesses.id
    and m.user_id = (select auth.uid()) and m.status = 'approved'));

revoke all on public.projects, public.businesses, public.business_members from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, delete on public.projects to authenticated;
grant insert (id, owner_user_id, project_info, builder_mode, selections, consultation_memo,
  special_notes, current_step, consultation_checks, image_history_order, content_modified_at, schema_version)
  on public.projects to authenticated;
grant update (project_info, builder_mode, selections, consultation_memo, special_notes,
  current_step, consultation_checks, image_history_order, content_modified_at, schema_version)
  on public.projects to authenticated;
grant select on public.businesses, public.business_members to authenticated;
-- UUID defaults use no sequences; no sequence privileges needed.
-- No business writes for API clients, including owners/admins. Approval is a
-- separate trusted operator workflow, never derived from user_metadata.
commit;
