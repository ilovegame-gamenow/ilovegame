-- Review before production use. Existing releases/articles are not rewritten.
begin;

create function public.valid_release_schedule(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare d date; precision text; state text;
begin
  if p is null or jsonb_typeof(p)<>'object'
    or not (p ?& array['status','release_date','date_precision','release_label'])
    or (p - array['status','release_date','date_precision','release_label'])<>'{}'::jsonb
    or jsonb_typeof(p->'status')<>'string' or jsonb_typeof(p->'date_precision')<>'string'
    or jsonb_typeof(p->'release_label')<>'string' or char_length(p->>'release_label')>500 then return false; end if;
  state:=p->>'status'; precision:=p->>'date_precision';
  if state not in ('announced','released','delayed','cancelled') then return false; end if;
  if precision='unknown' then
    return p->'release_date'='null'::jsonb and state<>'released';
  end if;
  if state in ('delayed','cancelled') or jsonb_typeof(p->'release_date')<>'string'
    or (p->>'release_date') !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  d:=(p->>'release_date')::date;
  return d between date '1900-01-01' and date '9999-12-31'
    and (precision='day' or (precision='month' and extract(day from d)=1)
      or (precision='year' and extract(month from d)=1 and extract(day from d)=1));
exception when invalid_datetime_format or datetime_field_overflow then return false;
end;
$$;

create table public.game_release_checks (
  id uuid primary key,
  release_id uuid not null references public.game_releases(id) on delete restrict,
  source_id uuid not null references public.game_sources(id) on delete restrict,
  source_values jsonb not null,
  outcome text not null check(outcome in ('unchanged','change_candidate','ambiguous','unavailable')),
  before_values jsonb not null,
  proposed jsonb,
  reason text not null check(char_length(btrim(reason)) between 1 and 2000),
  evidence text not null check(char_length(btrim(evidence)) between 1 and 8000),
  checked_at timestamptz not null default clock_timestamp(),
  resolution text not null check(resolution in ('recorded','pending','applied','rejected')),
  resolved_at timestamptz,
  applied_updated_at timestamptz,
  check(case when outcome in ('unchanged','change_candidate') then public.valid_release_schedule(proposed) else proposed is null end),
  check((outcome='change_candidate' and resolution in ('pending','applied','rejected'))
    or (outcome<>'change_candidate' and resolution='recorded')),
  check((resolution in ('applied','rejected'))=(resolved_at is not null)),
  check((resolution='applied')=(applied_updated_at is not null))
);
create index game_release_checks_recent_idx on public.game_release_checks(release_id,checked_at desc);
create index game_release_checks_pending_idx on public.game_release_checks(checked_at,id) where resolution='pending';

create table public.game_release_history (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.game_releases(id) on delete restrict,
  before_values jsonb not null,
  after_values jsonb not null,
  changed_at timestamptz not null default clock_timestamp()
);
create index game_release_history_release_idx on public.game_release_history(release_id,changed_at desc);

create function public.capture_game_release_history()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if (to_jsonb(old)-'updated_at') is distinct from (to_jsonb(new)-'updated_at') then
    insert into public.game_release_history(release_id,before_values,after_values)
      values(old.id,to_jsonb(old),to_jsonb(new));
  end if;
  return new;
end;
$$;
create trigger game_release_history_after_update after update on public.game_releases
  for each row execute function public.capture_game_release_history();

-- Stable caller ID makes a lost-response retry safe. No model inference runs in this transaction.
create function public.record_game_release_check(
  p_id uuid,p_release_id uuid,p_expected_updated_at timestamptz,p_source_id uuid,
  p_outcome text,p_proposed jsonb,p_reason text,p_evidence text
) returns public.game_release_checks language plpgsql security invoker set search_path='' as $$
declare r public.game_releases; s public.game_sources; saved public.game_release_checks; current_claim jsonb;
begin
  if p_id is null or p_release_id is null or p_source_id is null or p_expected_updated_at is null
    or p_outcome is null or p_outcome not in ('unchanged','change_candidate','ambiguous','unavailable')
    or p_reason is null or char_length(btrim(p_reason)) not between 1 and 2000
    or p_evidence is null or char_length(btrim(p_evidence)) not between 1 and 8000 then
    raise exception 'Invalid release check' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into saved from public.game_release_checks where id=p_id;
  if found then
    if saved.release_id<>p_release_id or saved.source_id<>p_source_id or saved.outcome<>p_outcome
      or (saved.before_values->>'updated_at')::timestamptz<>p_expected_updated_at
      or saved.proposed is distinct from p_proposed or saved.reason<>p_reason or saved.evidence<>p_evidence then
      raise exception 'Check ID reused with different content' using errcode='23505';
    end if;
    return saved;
  end if;
  select * into r from public.game_releases where id=p_release_id for share;
  if not found then raise exception 'Release not found' using errcode='P0002'; end if;
  if r.updated_at<>p_expected_updated_at then raise exception 'Release changed' using errcode='40001'; end if;
  select * into s from public.game_sources where id=p_source_id and game_id=r.game_id for share;
  if not found or s.source_type not in ('official','store') or s.review_status='rejected' then
    raise exception 'Official evidence for this work required' using errcode='22023';
  end if;
  if p_outcome in ('unchanged','change_candidate') then
    if s.review_status<>'verified' or not coalesce(public.valid_release_schedule(p_proposed),false) then
      raise exception 'Verified schedule required' using errcode='22023';
    end if;
    current_claim:=jsonb_build_object('status',r.status,'release_date',r.release_date,'date_precision',r.date_precision,'release_label',r.release_label);
    if (p_outcome='unchanged')<>(p_proposed=current_claim) then
      raise exception 'Outcome does not match schedule' using errcode='22023';
    end if;
  elsif p_proposed is not null then raise exception 'Ambiguous checks must not assert a new date' using errcode='22023'; end if;
  insert into public.game_release_checks(id,release_id,source_id,source_values,outcome,before_values,proposed,reason,evidence,resolution)
    values(p_id,r.id,s.id,to_jsonb(s),p_outcome,to_jsonb(r),p_proposed,p_reason,p_evidence,
      case when p_outcome='change_candidate' then 'pending' else 'recorded' end) returning * into saved;
  return saved;
end;
$$;

-- A single machine/region/kind row is updated, atomically with its decision and history.
create function public.resolve_game_release_check(p_id uuid,p_expected_updated_at timestamptz,p_decision text)
returns public.game_release_checks language plpgsql security invoker set search_path='' as $$
declare c public.game_release_checks; r public.game_releases; s public.game_sources;
begin
  if p_id is null or p_expected_updated_at is null or p_decision is null or p_decision not in ('apply','reject') then
    raise exception 'Invalid decision' using errcode='22023';
  end if;
  select * into c from public.game_release_checks where id=p_id for update;
  if not found then raise exception 'Check not found' using errcode='P0002'; end if;
  if c.outcome<>'change_candidate' then raise exception 'No candidate schedule' using errcode='22023'; end if;
  if c.resolution=(case when p_decision='apply' then 'applied' else 'rejected' end) then return c; end if;
  if c.resolution<>'pending' then raise exception 'Already resolved differently' using errcode='23505'; end if;
  if p_decision='reject' then
    update public.game_release_checks set resolution='rejected',resolved_at=clock_timestamp() where id=c.id returning * into c;
    return c;
  end if;
  select * into r from public.game_releases where id=c.release_id for update;
  if r.updated_at<>p_expected_updated_at or to_jsonb(r)<>c.before_values then
    raise exception 'Release changed; recheck required' using errcode='40001';
  end if;
  select * into s from public.game_sources where id=c.source_id and game_id=r.game_id for share;
  if not found or s.source_type not in ('official','store') or s.review_status<>'verified' or s.verified_at is null
    or to_jsonb(s)<>c.source_values then
    raise exception 'Evidence no longer verified' using errcode='23505';
  end if;
  update public.game_releases set status=c.proposed->>'status',release_date=(c.proposed->>'release_date')::date,
    date_precision=c.proposed->>'date_precision',release_label=c.proposed->>'release_label',source_id=c.source_id,verified_at=clock_timestamp()
    where id=r.id returning * into r;
  update public.game_release_checks set resolution='applied',resolved_at=clock_timestamp(),applied_updated_at=r.updated_at where id=c.id returning * into c;
  return c;
end;
$$;

create function public.list_game_release_rechecks(p_limit integer default 20)
returns table(release_id uuid,title text,platform_code text,region_code text,release_kind text,
  release_date date,date_precision text,status text,source_id uuid,source_url text,
  updated_at timestamptz,last_checked_at timestamptz,next_check_at timestamptz)
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid limit' using errcode='22023'; end if;
  return query with candidates as (
    select r.*,g.title,s.url,latest.checked_at,
      coalesce(latest.checked_at+case
        when latest.outcome in ('unavailable','ambiguous') or latest.resolution='pending' then interval '6 hours'
        when r.release_date between (now() at time zone 'Asia/Tokyo')::date-7 and (now() at time zone 'Asia/Tokyo')::date+7 then interval '1 day'
        when r.release_date<=(now() at time zone 'Asia/Tokyo')::date+30 then interval '3 days'
        else interval '14 days' end,'-infinity'::timestamptz) as due
    from public.game_releases r join public.games g on g.id=r.game_id join public.game_sources s on s.id=r.source_id
    left join lateral (select greatest(c.checked_at,c.resolved_at) as checked_at,c.outcome,c.resolution from public.game_release_checks c
      where c.release_id=r.id and ((c.before_values->>'updated_at')::timestamptz=r.updated_at or c.applied_updated_at=r.updated_at)
      order by greatest(c.checked_at,c.resolved_at) desc,c.id desc limit 1) latest on true
    where g.status='published' and r.region_code='JP' and r.verified_at is not null
      and s.review_status='verified' and s.source_type in ('official','store')
      and r.status in ('announced','delayed') and (r.release_date is null or r.release_date>=(now() at time zone 'Asia/Tokyo')::date-7)
  ) select c.id,c.title,c.platform_code,c.region_code,c.release_kind,c.release_date,c.date_precision,c.status,
      c.source_id,c.url,c.updated_at,c.checked_at,c.due from candidates c where c.due<=now()
    order by case when c.release_date<=(now() at time zone 'Asia/Tokyo')::date+7 then 0 else 1 end,c.due,c.release_date nulls last,c.id limit p_limit;
end;
$$;

alter table public.game_release_checks enable row level security;
alter table public.game_release_history enable row level security;
revoke all on public.game_release_checks,public.game_release_history from public,anon,authenticated;
grant select,insert on public.game_release_checks to service_role;
grant update(resolution,resolved_at,applied_updated_at) on public.game_release_checks to service_role;
grant select,insert on public.game_release_history to service_role;
revoke all on function public.valid_release_schedule(jsonb),public.capture_game_release_history(),
  public.record_game_release_check(uuid,uuid,timestamptz,uuid,text,jsonb,text,text),
  public.resolve_game_release_check(uuid,timestamptz,text),public.list_game_release_rechecks(integer) from public,anon,authenticated;
grant execute on function public.valid_release_schedule(jsonb),public.capture_game_release_history(),
  public.record_game_release_check(uuid,uuid,timestamptz,uuid,text,jsonb,text,text),
  public.resolve_game_release_check(uuid,timestamptz,text),public.list_game_release_rechecks(integer) to service_role;
commit;
