-- Manual-only researcher. Review before application; no schedules or AI calls in SQL.
begin;
create table public.game_research_runs (
  id uuid primary key,
  source text not null default 'steam-coming-soon' check(source='steam-coming-soon'),
  model text not null default 'gpt-5-mini' check(model='gpt-5-mini'),
  prompt_version text not null default 'steam-v1' check(prompt_version='steam-v1'),
  sources jsonb not null check(jsonb_typeof(sources)='array' and jsonb_array_length(sources) between 1 and 3 and octet_length(sources::text)<=18000),
  status text not null default 'prepared' check(status in ('prepared','running','completed','failed')),
  analysis jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index game_research_runs_started_idx on public.game_research_runs(started_at);
alter table public.game_research_runs enable row level security;
revoke all on public.game_research_runs from public,anon,authenticated;
grant select,insert,update on public.game_research_runs to service_role;

create function public.known_steam_research_ids(p_ids bigint[]) returns bigint[]
language sql stable security invoker set search_path='' as $$
  select coalesce(array_agg(distinct appid),'{}'::bigint[]) from (
    select substring(url from '^https?://store[.]steampowered[.]com/app/([0-9]{1,10})(/|$|[?])')::bigint as appid from public.game_sources
    union select substring(source_url from '^https?://store[.]steampowered[.]com/app/([0-9]{1,10})(/|$|[?])')::bigint from public.game_discoveries
  ) known where appid=any(p_ids);
$$;
revoke all on function public.known_steam_research_ids(bigint[]) from public,anon,authenticated;
grant execute on function public.known_steam_research_ids(bigint[]) to service_role;

create function public.prepare_game_research(p_id uuid,p_sources jsonb) returns public.game_research_runs
language plpgsql security invoker set search_path='' as $$
declare saved public.game_research_runs; s jsonb;
begin
  -- Fixed source identities only. Never fetch a URL supplied by an API caller.
  if p_sources is null or jsonb_typeof(p_sources)<>'array' or jsonb_array_length(p_sources) not between 1 and 3 or octet_length(p_sources::text)>18000 then
    raise exception 'Invalid research sources' using errcode='22023';
  end if;
  for s in select * from jsonb_array_elements(p_sources) loop
    if s->>'appid' is null or s->>'appid' !~ '^[1-9][0-9]{0,9}$' or s->>'url' is distinct from 'https://store.steampowered.com/app/'||(s->>'appid')||'/'
       or jsonb_typeof(s->'title') is distinct from 'string' or char_length(btrim(s->>'title')) not between 1 and 300
       or jsonb_typeof(s->'description') is distinct from 'string' or char_length(s->>'description') not between 60 and 4000
       or s->>'candidate_id' is null then raise exception 'Invalid Steam snapshot' using errcode='22023'; end if;
    perform (s->>'candidate_id')::uuid;
  end loop;
  if (select count(distinct value->>'appid') from jsonb_array_elements(p_sources))<>jsonb_array_length(p_sources) then
    raise exception 'Duplicate research app' using errcode='22023'; end if;
  insert into public.game_research_runs(id,sources) values(p_id,p_sources) on conflict(id) do nothing returning * into saved;
  if not found then select * into saved from public.game_research_runs where id=p_id; end if;
  return saved;
end $$;
revoke all on function public.prepare_game_research(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_game_research(uuid,jsonb) to service_role;

create function public.claim_game_research(p_id uuid) returns public.game_research_runs
language plpgsql security invoker set search_path='' as $$
declare saved public.game_research_runs;
begin
  perform pg_advisory_xact_lock(hashtext('ilovegame.manual-game-research'));
  select * into saved from public.game_research_runs where id=p_id for update;
  if not found then raise exception 'Research run not found' using errcode='P0002'; end if;
  if saved.status<>'prepared' or saved.created_at<now()-interval '30 minutes' then
    raise exception 'Research already started or expired' using errcode='23505'; end if;
  if exists(select 1 from public.game_research_runs where status='running' and started_at>now()-interval '10 minutes') then
    raise exception 'Another research run is active' using errcode='23505'; end if;
  if (select count(*) from public.game_research_runs where started_at>=date_trunc('day',now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')>=3 then
    raise exception 'Daily research limit reached' using errcode='23505'; end if;
  update public.game_research_runs set status='running',started_at=now() where id=p_id returning * into saved;
  return saved;
end $$;
revoke all on function public.claim_game_research(uuid) from public,anon,authenticated;
grant execute on function public.claim_game_research(uuid) to service_role;

create function public.complete_game_research(p_id uuid,p_result jsonb) returns public.game_research_runs
language plpgsql security invoker set search_path='' as $$
declare saved public.game_research_runs; item jsonb; s jsonb; candidate public.game_discoveries; existed boolean;
begin
  select * into saved from public.game_research_runs where id=p_id for update;
  if not found then raise exception 'Research run missing' using errcode='P0002'; end if;
  if saved.status='completed' then return saved; end if;
  if saved.status<>'running' then raise exception 'Research is not running' using errcode='23505'; end if;
  if p_result is null or jsonb_typeof(p_result->'items') is distinct from 'array'
     or jsonb_array_length(p_result->'items')<>jsonb_array_length(saved.sources)
     or (select count(distinct value->>'appid') from jsonb_array_elements(p_result->'items'))<>jsonb_array_length(saved.sources) then
    raise exception 'Invalid research results' using errcode='22023'; end if;
  for item in select * from jsonb_array_elements(p_result->'items') loop
    select value into s from jsonb_array_elements(saved.sources) where value->>'appid'=item->>'appid';
    if not found or jsonb_typeof(item->'selected') is distinct from 'boolean' then
      raise exception 'Invalid research result identity' using errcode='22023'; end if;
    if (item->>'selected')::boolean then
      if jsonb_typeof(item->'description') is distinct from 'string' or char_length(btrim(item->>'description')) not between 1 and 3000
         or jsonb_typeof(item->'reason') is distinct from 'string' or char_length(btrim(item->>'reason')) not between 1 and 2000
         or jsonb_typeof(item->'evidence') is distinct from 'string' or char_length(btrim(item->>'evidence')) not between 1 and 500
         or strpos(s->>'description',item->>'evidence')=0 then raise exception 'Research evidence invalid' using errcode='22023'; end if;
      select exists(select 1 from public.game_discoveries where id=(s->>'candidate_id')::uuid) into existed;
      candidate:=public.register_game_discovery((s->>'candidate_id')::uuid,s->>'title','',item->>'description',item->>'reason',s->>'url','store');
      if not existed and candidate.id=(s->>'candidate_id')::uuid then
        update public.game_discoveries set discovered_by='ai',research_metadata=jsonb_build_object(
          'run_id',saved.id,'source',saved.source,'appid',s->'appid','evidence',item->>'evidence',
          'model',coalesce(p_result->>'model',saved.model),'prompt_version',saved.prompt_version,'observed_at',saved.created_at)
          where id=candidate.id;
      end if;
    end if;
  end loop;
  update public.game_research_runs set status='completed',analysis=p_result,completed_at=now() where id=p_id returning * into saved;
  return saved;
end $$;
revoke all on function public.complete_game_research(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_game_research(uuid,jsonb) to service_role;

create function public.fail_game_research(p_id uuid) returns void
language sql security invoker set search_path='' as $$
  update public.game_research_runs set status='failed',error_message='結果を確定できませんでした。料金の二重発生を避けるため自動再実行しません。',completed_at=now()
    where id=p_id and status='running';
$$;
revoke all on function public.fail_game_research(uuid) from public,anon,authenticated;
grant execute on function public.fail_game_research(uuid) to service_role;
commit;
