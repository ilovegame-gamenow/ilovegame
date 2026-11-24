# PICK UPの日替わり更新

毎朝05:00 JST（UTC 20:00）に `ilovegame-pickup-rotation` が稼働。表示中の枠を保持し、原則1件を未表示候補（新しいもの優先）または最も久しく表示されていない候補と交換する。同一作品の関連ID・作品名の重複を避ける。期限切れ、公開状態の変更、表示件数変更、候補不足では例外として補充または据え置き。既存の候補期限および公開状態を変更しない。NEWS FEEDの除外は既存の共通セレクターに従う。

Migration `daily_pickup_rotation`（適用済み）:
```sql
alter table public.article_feature_slots add column pickup_rank integer check(pickup_rank between 1 and 12), add column pickup_last_shown_on date;
create schema pickup_rotation;
revoke all on schema pickup_rotation from public,anon,authenticated,service_role;
create table pickup_rotation.state(id integer primary key check(id=1),last_day date);
alter table pickup_rotation.state enable row level security;
insert into pickup_rotation.state(id) values(1);
create function pickup_rotation.rotate() returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 local_day date := ((now() at time zone 'Asia/Tokyo')-interval '5 hours')::date;
 cutoff timestamptz := (local_day+time '05:00') at time zone 'Asia/Tokyo';
 previous_day date; cap integer; max_age integer; roster bigint[]; candidate bigint; first_run boolean; full_before boolean;
begin
 select last_day into previous_day from pickup_rotation.state where id=1 for update;
 if previous_day=local_day then return jsonb_build_object('status','already_rotated'); end if;
 select pickup_max_articles,breaking_max_age_hours into cap,max_age from public.site_settings where id=1;
 if cap is null or cap<1 or cap>12 then raise exception 'Invalid pickup display settings'; end if;
 first_run:=previous_day is null;
 select coalesce(array_agg(q.article_id order by q.pickup_rank),array[]::bigint[]) into roster from (
  select s.article_id,s.pickup_rank from public.article_feature_slots s join public.published_articles a on a.id=s.article_id
  where s.slot='discovery' and s.selected_at<=cutoff and s.expires_at>now() and s.pickup_rank is not null
  order by s.pickup_rank limit cap
 ) q;
 full_before:=cardinality(roster)>=cap;
 loop
  candidate:=null;
  select s.article_id into candidate from public.article_feature_slots s join public.published_articles a on a.id=s.article_id
   where s.slot='discovery' and s.selected_at<=cutoff and s.expires_at>now() and not(s.article_id=any(roster))
   and not exists(select 1 from public.article_feature_slots b where b.article_id=s.article_id and b.slot='breaking' and b.selected_at<=now() and b.expires_at>now() and b.selected_at>=now()-make_interval(hours=>max_age))
   and not exists(select 1 from public.article_games g join public.article_games old on old.game_id=g.game_id where g.article_id=s.article_id and old.article_id=any(roster))
   and not exists(select 1 from public.articles old where old.id=any(roster) and nullif(lower(trim(a.game_title)),'')=nullif(lower(trim(old.game_title)),''))
   order by (s.pickup_last_shown_on is not null),s.pickup_last_shown_on asc nulls first,s.selected_at desc,s.article_id desc limit 1;
  if candidate is null then exit; end if;
  if full_before then roster:=array_prepend(candidate,roster[1:cap-1]); exit; end if;
  roster:=array_append(roster,candidate);
  if cardinality(roster)>=cap then exit; end if;
 end loop;
 update public.article_feature_slots s set pickup_rank=array_position(roster,s.article_id),pickup_last_shown_on=case when s.article_id=any(roster) then local_day else s.pickup_last_shown_on end
 where s.slot='discovery' and (s.pickup_rank is not null or s.article_id=any(roster));
 update pickup_rotation.state set last_day=local_day where id=1;
 return jsonb_build_object('status','rotated','count',cardinality(roster));
end $$;
revoke all on function pickup_rotation.rotate() from public,anon,authenticated,service_role;
select pickup_rotation.rotate();
select cron.schedule('ilovegame-pickup-rotation','0 20 * * *','select pickup_rotation.rotate();');
```
