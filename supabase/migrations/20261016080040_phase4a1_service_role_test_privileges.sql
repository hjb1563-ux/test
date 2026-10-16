-- Pending approval: bath-designer-dev (istsrambmbzuemkgutgh) only.
-- Operator observation and cleanup for phase2-rls.mjs; never a browser credential.
-- Fixture SQL runs separately as postgres. No service_role INSERT is needed.
grant select, delete on public.projects, public.businesses, public.business_members to service_role;

-- Only fields that cleanup() may restore; no id/created_at/revision/updated_at.
-- owner_user_id is never restored by PATCH; its immutable trigger remains intact.
grant update (project_info, builder_mode, selections,
  consultation_memo, special_notes, current_step, consultation_checks,
  image_history_order, content_modified_at, schema_version)
  on public.projects to service_role;

grant update (role, status)
  on public.business_members to service_role;
