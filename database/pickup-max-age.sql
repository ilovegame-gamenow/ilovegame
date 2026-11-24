alter table public.site_settings add column pickup_max_age_days integer not null default 3 check (pickup_max_age_days between 1 and 14);
CREATE OR REPLACE FUNCTION pickup_rotation.rotate()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 local_day date := ((now() at time zone 'Asia/Tokyo')-interval '5 hours')::date;
 cutoff timestamptz := (local_day+time '05:00') at time zone 'Asia/Tokyo';
 previous_day date; cap integer; max_age integer; pickup_days integer; roster bigint[]; candidate bigint; first_run boolean; full_before boolean;
begin
 select last_day into previous_day from pickup_rotation.state where id=1 for update;
 if previous_day=local_day then return jsonb_build_object('status','already_rotated'); end if;
 select pickup_max_articles,breaking_max_age_hours,pickup_max_age_days into cap,max_age,pickup_days from public.site_settings where id=1;
 if cap is null or cap<1 or cap>12 then raise exception 'Invalid pickup display settings'; end if;
 first_run:=previous_day is null;
 select coalesce(array_agg(q.article_id order by q.pickup_rank),array[]::bigint[]) into roster from (
  select s.article_id,s.pickup_rank from public.article_feature_slots s join public.published_articles a on a.id=s.article_id
  where s.slot='discovery' and s.selected_at<=cutoff and s.expires_at>now() and s.selected_at>now()-make_interval(days=>pickup_days) and s.pickup_rank is not null
  order by s.pickup_rank limit cap
 ) q;
 full_before:=cardinality(roster)>=cap;
 loop
  candidate:=null;
  select s.article_id into candidate from public.article_feature_slots s join public.published_articles a on a.id=s.article_id
   where s.slot='discovery' and s.selected_at<=cutoff and s.expires_at>now() and s.selected_at>now()-make_interval(days=>pickup_days) and not(s.article_id=any(roster))
   and not exists(select 1 from public.article_feature_slots b where b.article_id=s.article_id and b.slot='breaking' and b.selected_at<=now() and b.expires_at>now() and b.selected_at>=now()-make_interval(hours=>max_age))
   and not exists(select 1 from public.article_games g join public.article_games old on old.game_id=g.game_id where g.article_id=s.article_id and old.article_id=any(roster))
   and not exists(select 1 from public.articles old where old.id=any(roster) and nullif(lower(trim(a.game_title)),'')=nullif(lower(trim(old.game_title)),''))
   order by (a.importance>=90 and s.selected_at>=cutoff-interval '1 day') desc nulls last,(s.pickup_last_shown_on is not null),s.pickup_last_shown_on asc nulls first,s.selected_at desc,s.article_id desc limit 1;
  if candidate is null then exit; end if;
  if full_before then roster:=array_prepend(candidate,roster[1:cap-1]); exit; end if;
  roster:=array_append(roster,candidate);
  if cardinality(roster)>=cap then exit; end if;
 end loop;
 update public.article_feature_slots s set pickup_rank=array_position(roster,s.article_id),pickup_last_shown_on=case when s.article_id=any(roster) then local_day else s.pickup_last_shown_on end
 where s.slot='discovery' and (s.pickup_rank is not null or s.article_id=any(roster));
 update pickup_rotation.state set last_day=local_day where id=1;
 return jsonb_build_object('status','rotated','count',cardinality(roster));
end $function$
;
