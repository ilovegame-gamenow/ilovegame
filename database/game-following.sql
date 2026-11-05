-- Private editorial preferences; independent of publication and calendar data.
begin;
create table public.game_following (
 game_id uuid primary key references public.games(id) on delete cascade,
 is_favorite boolean not null default false,
 is_managed boolean not null default true,
 last_checked_at timestamptz,
 check_outcome text check(check_outcome in ('no_change','news_found','partial','failed')),
 check_note text not null default '' check(char_length(check_note)<=2000),
 checked_sources jsonb not null default '[]'::jsonb check(jsonb_typeof(checked_sources)='array'),
 updated_at timestamptz not null default now(),
 check(is_managed or not is_favorite)
);
alter table public.game_following enable row level security;
revoke all on public.game_following from public,anon,authenticated;
grant select,insert,update,delete on public.game_following to service_role;
create index game_following_favorites on public.game_following(last_checked_at nulls first,game_id) where is_favorite and is_managed;

create function public.search_managed_games(p_query text,p_offset integer,p_filter text default 'managed') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_query is null or char_length(p_query)>100 or p_offset is null or p_offset<0 or p_offset>200000 or p_filter is null or p_filter not in ('managed','favorites','removed','all') then raise exception 'Invalid search' using errcode='22023';end if;
 return coalesce((select jsonb_agg(rowdata order by created_at desc,id desc) from (
 select g.id,g.created_at,to_jsonb(g)||jsonb_build_object('is_favorite',coalesce(f.is_favorite,false),'is_managed',coalesce(f.is_managed,true),'last_checked_at',f.last_checked_at,'check_outcome',f.check_outcome,'check_note',f.check_note) as rowdata
 from public.games g left join public.game_following f on f.game_id=g.id
 where (strpos(lower(g.title),lower(p_query))>0 or strpos(lower(coalesce(g.original_title,'')),lower(p_query))>0)
 and (p_filter='all' or (p_filter='managed' and coalesce(f.is_managed,true)) or (p_filter='favorites' and f.is_favorite and f.is_managed) or (p_filter='removed' and not f.is_managed))
 order by g.created_at desc,g.id desc limit 21 offset p_offset
 ) rows),'[]'::jsonb);
end $$;
create function public.set_game_following(p_game_id uuid,p_action text) returns public.game_following
language plpgsql security invoker set search_path='' as $$
declare saved public.game_following;
begin
 if p_game_id is null or p_action is null or p_action not in ('favorite_on','favorite_off','remove','restore') then raise exception 'Invalid action' using errcode='22023';end if;
 insert into public.game_following(game_id) values(p_game_id) on conflict do nothing;
 update public.game_following set
 is_favorite=case when p_action='favorite_on' then true when p_action in ('favorite_off','remove') then false else is_favorite end,
 is_managed=case when p_action='remove' then false when p_action in ('restore','favorite_on') then true else is_managed end,
 updated_at=clock_timestamp() where game_id=p_game_id returning * into saved;
 return saved;
end $$;
create function public.create_followed_game(p_id uuid,p_title text,p_original_title text,p_description text,p_source_url text,p_source_type text) returns public.games
language plpgsql security invoker set search_path='' as $$
declare saved public.games;
begin
 -- Serialize duplicate registrations of the same store/official URL.
 perform pg_advisory_xact_lock(hashtextextended(p_source_url,0));
 if exists(select 1 from public.games where id=p_id) then
   saved:=public.create_editor_game(p_id,p_title,p_original_title,p_description,p_source_url,p_source_type);
   return saved; -- Retries must not re-enable a subsequently disabled favorite.
 end if;
 select g.* into saved from public.games g join public.game_sources s on s.game_id=g.id
 where s.url=p_source_url and (p_source_type='store' or (lower(g.title)=lower(btrim(p_title)) and coalesce(g.original_title,'')=btrim(p_original_title))) order by g.created_at limit 1;
 if not found then saved:=public.create_editor_game(p_id,p_title,p_original_title,p_description,p_source_url,p_source_type);end if;
 perform public.set_game_following(saved.id,'favorite_on');
 return saved;
end $$;
create function public.record_game_following_check(p_game_id uuid,p_started_at timestamptz,p_outcome text,p_note text,p_sources jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 if p_started_at is null or p_started_at>clock_timestamp() or p_outcome is null or p_outcome not in ('no_change','news_found','partial','failed') or p_note is null or char_length(p_note)>2000 or p_sources is null or jsonb_typeof(p_sources)<>'array' or pg_column_size(p_sources)>20000 then raise exception 'Invalid check' using errcode='22023';end if;
 update public.game_following set last_checked_at=clock_timestamp(),check_outcome=p_outcome,check_note=p_note,checked_sources=p_sources
 where game_id=p_game_id and is_favorite and is_managed and updated_at<=p_started_at and (last_checked_at is null or last_checked_at<=p_started_at);
 return found;
end $$;
create function public.register_followed_title(p_id uuid,p_title text) returns public.games
language plpgsql security invoker set search_path='' as $$
declare saved public.games;
begin
 if p_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 100 then raise exception 'Invalid title' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_title)),1));
 select * into saved from public.games where id=p_id;
 if found then
  if saved.title<>btrim(p_title) then raise exception 'Creation ID conflict' using errcode='23505';end if;
  return saved;
 end if;
 select * into saved from public.games where lower(title)=lower(btrim(p_title)) order by created_at limit 1;
 if not found then
  insert into public.games(id,title,description) values(p_id,btrim(p_title),'公式出典の確認待ち：タイトルを指定して追跡登録') returning * into saved;
 end if;
 perform public.set_game_following(saved.id,'favorite_on');
 return saved;
end $$;
revoke all on function public.register_followed_title(uuid,text) from public,anon,authenticated;
grant execute on function public.register_followed_title(uuid,text) to service_role;
revoke all on function public.search_managed_games(text,integer,text),public.set_game_following(uuid,text),public.create_followed_game(uuid,text,text,text,text,text),public.record_game_following_check(uuid,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.search_managed_games(text,integer,text),public.set_game_following(uuid,text),public.create_followed_game(uuid,text,text,text,text,text),public.record_game_following_check(uuid,timestamptz,text,text,jsonb) to service_role;
commit;
