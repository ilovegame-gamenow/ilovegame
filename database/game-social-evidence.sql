-- Additive, reviewed deployment only. Existing articles and source reviews are unchanged.
begin;
create table public.game_social_observations (
  source_id uuid not null references public.game_sources(id) on delete cascade,
  observed_at timestamptz not null check (isfinite(observed_at)),
  platform text not null check (platform='bluesky'),
  actor text not null check (char_length(actor) between 1 and 300),
  verified_by text not null check (verified_by ~ '^https://[^[:space:]]+$'),
  published_at timestamptz not null check (isfinite(published_at)),
  likes bigint check (likes between 0 and 9007199254740991),
  reposts bigint check (reposts between 0 and 9007199254740991),
  replies bigint check (replies between 0 and 9007199254740991),
  quotes bigint check (quotes between 0 and 9007199254740991),
  primary key(source_id,observed_at)
);
alter table public.game_social_observations enable row level security;
revoke all on public.game_social_observations from public,anon,authenticated;
grant select,insert on public.game_social_observations to service_role;
create function public.save_game_social_evidence(p_input jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare source uuid; saved public.game_social_observations;
begin
  if p_input->>'platform' is distinct from 'bluesky'
    or p_input->>'actor' is distinct from 'amongusstory.bsky.social'
    or p_input->>'verified_by' is distinct from 'https://www.innersloth.com/among-us-story-on-guard-demo-available-now/'
    or p_input->>'post_url' is null
    or p_input->>'post_url' !~ '^https://bsky.app/profile/amongusstory\.bsky\.social/post/[a-zA-Z0-9]+$' then
    raise exception 'Invalid social evidence' using errcode='22023';
  end if;
  insert into public.game_sources(game_id,url,source_type)
    values ((p_input->>'game_id')::uuid,p_input->>'post_url','official')
    on conflict(game_id,url) do nothing;
  select id into strict source from public.game_sources
    where game_id=(p_input->>'game_id')::uuid and url=p_input->>'post_url';
  insert into public.game_social_observations(source_id,observed_at,platform,actor,verified_by,published_at,likes,reposts,replies,quotes)
    values(source,(p_input->>'observed_at')::timestamptz,p_input->>'platform',p_input->>'actor',p_input->>'verified_by',
      (p_input->>'published_at')::timestamptz,(p_input->>'likes')::bigint,(p_input->>'reposts')::bigint,(p_input->>'replies')::bigint,(p_input->>'quotes')::bigint)
    on conflict(source_id,observed_at) do nothing;
  select * into strict saved from public.game_social_observations where source_id=source and observed_at=(p_input->>'observed_at')::timestamptz;
  if saved.published_at is distinct from (p_input->>'published_at')::timestamptz
    or saved.likes is distinct from (p_input->>'likes')::bigint or saved.reposts is distinct from (p_input->>'reposts')::bigint
    or saved.replies is distinct from (p_input->>'replies')::bigint or saved.quotes is distinct from (p_input->>'quotes')::bigint then
    raise exception 'Observation already stored with different data' using errcode='23505';
  end if;
  return source;
end;$$;
revoke all on function public.save_game_social_evidence(jsonb) from public,anon,authenticated;
grant execute on function public.save_game_social_evidence(jsonb) to service_role;
commit;
