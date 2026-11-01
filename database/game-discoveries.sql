-- Review before production application. Depends on game-catalog and game-catalog-editor.
begin;
create table public.game_discoveries (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(btrim(title)) between 1 and 300),
  original_title text not null default '' check(char_length(original_title)<=300),
  description text not null default '' check(char_length(description)<=5000),
  reason text not null check(char_length(btrim(reason)) between 1 and 2000),
  source_url text not null check(char_length(source_url)<=2000 and source_url ~ '^https?://[^[:space:]]+$'),
  source_type text not null check(source_type in ('official','store','media','community')),
  discovered_by text not null default 'manual' check(discovered_by in ('manual','ai')),
  research_metadata jsonb not null default '{}' check(jsonb_typeof(research_metadata)='object'),
  status text not null default 'pending' check(status in ('pending','held','adopted')),
  adopted_game_id uuid references public.games(id) on delete restrict,
  observed_at timestamptz not null default now(),
  adopted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((status='adopted' and adopted_game_id is not null and adopted_at is not null) or
        (status<>'adopted' and adopted_game_id is null and adopted_at is null))
);
-- One source page can describe many games. A URL alone is not a candidate identity.
create unique index game_discoveries_source_title_key on public.game_discoveries(source_url,lower(btrim(title)));
create index game_discoveries_review_idx on public.game_discoveries(status,created_at desc,id desc);
create index game_discoveries_game_idx on public.game_discoveries(adopted_game_id);
create trigger game_discoveries_updated_at before update on public.game_discoveries
  for each row execute function public.touch_game_catalog_updated_at();
alter table public.game_discoveries enable row level security;
revoke all on public.game_discoveries from public, anon, authenticated;
grant select,insert,update,delete on public.game_discoveries to service_role;

create function public.register_game_discovery(p_id uuid,p_title text,p_original_title text,p_description text,p_reason text,p_source_url text,p_source_type text)
returns public.game_discoveries language plpgsql security invoker set search_path='' as $$
declare saved public.game_discoveries;
begin
  insert into public.game_discoveries(id,title,original_title,description,reason,source_url,source_type)
    values(p_id,btrim(p_title),btrim(p_original_title),p_description,btrim(p_reason),p_source_url,p_source_type)
    on conflict do nothing returning * into saved;
  if found then return saved; end if;
  select * into saved from public.game_discoveries where id=p_id;
  if found then
    if saved.title is distinct from btrim(p_title) or saved.original_title is distinct from btrim(p_original_title)
       or saved.description is distinct from p_description or saved.reason is distinct from btrim(p_reason)
       or saved.source_url is distinct from p_source_url or saved.source_type is distinct from p_source_type then
      raise exception 'Candidate ID used for different content' using errcode='23505';
    end if;
  else
    select * into saved from public.game_discoveries where source_url=p_source_url and lower(btrim(title))=lower(btrim(p_title));
  end if;
  return saved;
end $$;
revoke all on function public.register_game_discovery(uuid,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.register_game_discovery(uuid,text,text,text,text,text,text) to service_role;

create function public.list_game_discoveries(p_status text,p_offset integer)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if p_status is null or p_status not in ('pending','held','adopted') or p_offset is null or p_offset<0 or p_offset>200000 then
    raise exception 'Invalid candidate query' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(row_data order by created_at desc,id desc),'[]'::jsonb) into result from (
    select d.created_at,d.id,to_jsonb(d)||jsonb_build_object('matches',(
      select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from (
        select g.id,g.title,g.original_title,
          case when matching.same_source then 'source' else 'title' end as match_type
        from public.games g cross join lateral (
          select exists(select 1 from public.game_sources s where s.game_id=g.id and s.url=d.source_url) as same_source,
            lower(btrim(g.title))=lower(btrim(d.title)) as same_title,
            (d.original_title<>'' and lower(btrim(coalesce(g.original_title,'')))=lower(btrim(d.original_title))) as same_original
        ) matching
        where g.status<>'archived' and (matching.same_source or matching.same_title or matching.same_original)
        order by matching.same_source desc,matching.same_title desc,g.id limit 10
      ) m
    )) as row_data
    from public.game_discoveries d where d.status=p_status order by d.created_at desc,d.id desc limit 21 offset p_offset
  ) page;
  return result;
end $$;
revoke all on function public.list_game_discoveries(text,integer) from public,anon,authenticated;
grant execute on function public.list_game_discoveries(text,integer) to service_role;

create function public.review_game_discovery(p_id uuid,p_action text,p_game_id uuid)
returns public.game_discoveries language plpgsql security invoker set search_path='' as $$
declare candidate public.game_discoveries; target uuid;
begin
  if p_action is null or p_action not in ('hold','reopen','adopt_new','adopt_existing')
     or (p_action='adopt_existing' and p_game_id is null) or (p_action<>'adopt_existing' and p_game_id is not null) then
    raise exception 'Invalid review action' using errcode='22023';
  end if;
  select * into candidate from public.game_discoveries where id=p_id for update;
  if not found then raise exception 'Candidate missing' using errcode='P0002'; end if;
  target:=case when p_action='adopt_new' then candidate.id else p_game_id end;
  if candidate.status='adopted' then
    if p_action in ('adopt_new','adopt_existing') and candidate.adopted_game_id=target then return candidate; end if;
    raise exception 'Candidate already adopted' using errcode='23505';
  end if;
  if p_action in ('hold','reopen') then
    update public.game_discoveries set status=case when p_action='hold' then 'held' else 'pending' end where id=p_id returning * into candidate;
    return candidate;
  end if;
  if p_action='adopt_new' then
    perform public.create_editor_game(target,candidate.title,candidate.original_title,candidate.description,candidate.source_url,candidate.source_type);
  else
    perform id from public.games where id=target and status<>'archived' for key share;
    if not found then raise exception 'Target game missing or archived' using errcode='23503'; end if;
    insert into public.game_sources(game_id,url,source_type) values(target,candidate.source_url,candidate.source_type)
      on conflict(game_id,url) do nothing;
  end if;
  update public.game_discoveries set status='adopted',adopted_game_id=target,adopted_at=now() where id=p_id returning * into candidate;
  return candidate;
end $$;
revoke all on function public.review_game_discovery(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.review_game_discovery(uuid,text,uuid) to service_role;
commit;
