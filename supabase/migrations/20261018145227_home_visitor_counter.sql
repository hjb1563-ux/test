-- PREPARED ONLY; no remote application authorized by this implementation.
begin;
create schema bath_metrics;
revoke all on schema bath_metrics from public, anon, authenticated, service_role;
create table bath_metrics.days (
  day date primary key,
  total bigint not null default 0 check (total >= 0),
  minute timestamptz not null default date_trunc('minute', now()),
  registrations integer not null default 0 check (registrations between 0 and 120)
);
create table bath_metrics.visits (
  day date not null references bath_metrics.days(day),
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  primary key (day, visitor_hash)
);
alter table bath_metrics.days enable row level security;
alter table bath_metrics.visits enable row level security;
revoke all on all tables in schema bath_metrics from public, anon, authenticated, service_role;
create function bath_metrics.today(p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_day is null or p_day <> (clock_timestamp() at time zone 'Asia/Seoul')::date then
    raise exception 'Invalid metric day' using errcode = '22023';
  end if;
  return jsonb_build_object('date', p_day, 'count', coalesce((select total from bath_metrics.days where day = p_day), 0));
end;
$$;
create function bath_metrics.register(p_day date, p_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'Asia/Seoul')::date;
  v_row bath_metrics.days%rowtype;
begin
  if p_day is null or p_day <> v_day or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid metric input' using errcode = '22023';
  end if;
  insert into bath_metrics.days(day) values (v_day) on conflict (day) do nothing;
  select * into strict v_row from bath_metrics.days where day = v_day for update;
  -- Use lock-acquisition time, not queued request time, for the rate window.
  -- If waiting crossed Seoul midnight, retry on the new day without any count.
  v_now := clock_timestamp();
  if v_day <> (v_now at time zone 'Asia/Seoul')::date then
    raise exception 'Metric day changed; retry' using errcode = '22023';
  end if;
  if exists (select 1 from bath_metrics.visits where day = v_day and visitor_hash = p_hash) then
    return jsonb_build_object('date', v_day, 'count', v_row.total);
  end if;
  if v_row.minute <> date_trunc('minute', v_now) then
    v_row.minute := date_trunc('minute', v_now);
    v_row.registrations := 0;
  end if;
  if v_row.registrations >= 120 then
    raise sqlstate 'PT429' using message = 'Metric capacity exceeded';
  end if;
  insert into bath_metrics.visits(day, visitor_hash) values (v_day, p_hash);
  update bath_metrics.days set total = total + 1, minute = v_row.minute,
    registrations = v_row.registrations + 1 where day = v_day returning * into v_row;
  -- Opportunistic expiry; hard TTL needs an approved scheduled cleanup.
  delete from bath_metrics.visits where day < v_day - 1;
  return jsonb_build_object('date', v_day, 'count', v_row.total);
end;
$$;
revoke all on function bath_metrics.today(date), bath_metrics.register(date,text) from public, anon, authenticated, service_role;
grant usage on schema bath_metrics to service_role;
grant execute on function bath_metrics.today(date), bath_metrics.register(date,text) to service_role;
-- Exposed wrappers are invoker, not elevated public functions.
create function public.bath_visitor_today(p_day date) returns jsonb
language sql stable security invoker set search_path = '' as $$ select bath_metrics.today(p_day); $$;
create function public.bath_visitor_register(p_day date, p_hash text) returns jsonb
language sql security invoker set search_path = '' as $$ select bath_metrics.register(p_day, p_hash); $$;
revoke all on function public.bath_visitor_today(date), public.bath_visitor_register(date,text) from public, anon, authenticated, service_role;
grant execute on function public.bath_visitor_today(date), public.bath_visitor_register(date,text) to service_role;
commit;
