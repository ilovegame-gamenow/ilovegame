-- Apply after game-catalog.sql, following review. No changes to existing articles.
begin;

-- Caller supplies a stable UUID so a retry after a lost response cannot insert twice.
create function public.create_editor_game(
  p_id uuid, p_title text, p_original_title text, p_description text,
  p_source_url text, p_source_type text
) returns public.games
language plpgsql security invoker set search_path = '' as $$
declare
  saved public.games;
begin
  if p_id is null or p_title is null or char_length(btrim(p_title)) not between 1 and 300
     or p_original_title is null or char_length(p_original_title) > 300
     or p_description is null or char_length(p_description) > 5000
     or p_source_url is null or char_length(p_source_url) > 2000
     or p_source_url !~ '^https?://[^[:space:]]+$'
     or p_source_type is null or p_source_type not in ('official','store','media','community') then
    raise exception 'Invalid game input' using errcode = '22023';
  end if;

  insert into public.games (id,title,original_title,description)
    values (p_id,btrim(p_title),nullif(btrim(p_original_title),''),p_description)
    on conflict (id) do nothing returning * into saved;
  if found then
    insert into public.game_sources (game_id,url,source_type)
      values (saved.id,p_source_url,p_source_type);
  else
    select * into saved from public.games where id=p_id;
    if saved.title is distinct from btrim(p_title)
       or saved.original_title is distinct from nullif(btrim(p_original_title),'')
       or saved.description is distinct from p_description
       or not exists (select 1 from public.game_sources where game_id=p_id and url=p_source_url and source_type=p_source_type) then
      raise exception 'Creation ID already used for different content' using errcode = '23505';
    end if;
  end if;
  return saved;
end;
$$;
revoke all on function public.create_editor_game(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_editor_game(uuid,text,text,text,text,text) to service_role;

-- Parameterized substring search: punctuation and SQL/REST wildcard characters are literal.
create function public.search_editor_games(p_query text, p_offset integer)
returns setof public.games
language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_query is null or char_length(p_query)>100 or p_offset is null or p_offset<0 or p_offset>200000 then
    raise exception 'Invalid search input' using errcode = '22023';
  end if;
  return query select * from public.games
    where strpos(lower(title),lower(p_query))>0 or strpos(lower(coalesce(original_title,'')),lower(p_query))>0
    order by created_at desc,id desc limit 21 offset p_offset;
end;
$$;
revoke all on function public.search_editor_games(text,integer) from public, anon, authenticated;
grant execute on function public.search_editor_games(text,integer) to service_role;

commit;
