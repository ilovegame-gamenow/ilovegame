\set ON_ERROR_STOP on
\ir ../../database/game-release-maintenance.sql
begin;
insert into public.games(id,title,status) values
 ('00000000-0000-0000-0000-000000000901','Maintenance fixture','published'),
 ('00000000-0000-0000-0000-000000000902','Different work','published');
insert into public.game_sources(id,game_id,url,source_type,review_status,verified_at) values
 ('00000000-0000-0000-0000-000000000911','00000000-0000-0000-0000-000000000901','https://example.org/release','official','verified',now()),
 ('00000000-0000-0000-0000-000000000912','00000000-0000-0000-0000-000000000902','https://example.org/other','official','verified',now());
insert into public.game_releases(id,game_id,platform_code,region_code,release_date,date_precision,source_id,verified_at) values
 ('00000000-0000-0000-0000-000000000921','00000000-0000-0000-0000-000000000901','switch-2','JP',(now() at time zone 'Asia/Tokyo')::date+2,'day','00000000-0000-0000-0000-000000000911',now()),
 ('00000000-0000-0000-0000-000000000922','00000000-0000-0000-0000-000000000901','ps5','JP',(now() at time zone 'Asia/Tokyo')::date+2,'day','00000000-0000-0000-0000-000000000911',now()),
 ('00000000-0000-0000-0000-000000000923','00000000-0000-0000-0000-000000000901','switch-2','WW',(now() at time zone 'Asia/Tokyo')::date+2,'day','00000000-0000-0000-0000-000000000911',now()),
 ('00000000-0000-0000-0000-000000000924','00000000-0000-0000-0000-000000000901','windows','JP',(now() at time zone 'Asia/Tokyo')::date+60,'day','00000000-0000-0000-0000-000000000911',now());

-- Run the real RPCs as the production server role, including trigger permissions.
set local role service_role;
do $$
declare r public.game_releases; c public.game_release_checks; retry public.game_release_checks; claim jsonb; request_id uuid:=gen_random_uuid(); failed boolean;
begin
 select * into r from public.game_releases where id='00000000-0000-0000-0000-000000000921';
 claim:=jsonb_build_object('status','announced','release_date',r.release_date,'date_precision','day','release_label',r.release_label);
 if public.valid_release_schedule(claim||'{"release_date":"2027-02-30"}') then raise exception 'Impossible date accepted'; end if;
 if public.valid_release_schedule(claim||'{"extra":true}') then raise exception 'Unknown field accepted'; end if;
 if public.valid_release_schedule(claim||'{"status":"delayed"}') then raise exception 'Old day retained for indefinite postponement'; end if;
 if not exists(select 1 from public.list_game_release_rechecks(100) where release_id=r.id) then raise exception 'New release not due'; end if;
 if exists(select 1 from public.list_game_release_rechecks(100) where region_code<>'JP') then raise exception 'Foreign row included'; end if;
 c:=public.record_game_release_check(request_id,r.id,r.updated_at,r.source_id,'unchanged',claim,'Still scheduled','Official date confirmed in JST');
 retry:=public.record_game_release_check(request_id,r.id,r.updated_at,r.source_id,'unchanged',claim,'Still scheduled','Official date confirmed in JST');
 if retry.id<>c.id or (select count(*) from public.game_release_checks where id=c.id)<>1 then raise exception 'Retry duplicated'; end if;
 if exists(select 1 from public.list_game_release_rechecks(100) where release_id=r.id) then raise exception 'Successful check not cooled down'; end if;
 failed:=false;
 begin perform public.record_game_release_check(request_id,r.id,r.updated_at,r.source_id,'ambiguous',null,'Other','Other');
 exception when unique_violation then failed:=true; end;
 if not failed then raise exception 'ID content changed'; end if;
 failed:=false;
 begin perform public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,'00000000-0000-0000-0000-000000000912','unchanged',claim,'Other work','Wrong evidence');
 exception when invalid_parameter_value then failed:=true; end;
 if not failed then raise exception 'Cross-work source accepted'; end if;

 claim:=claim||jsonb_build_object('release_date',r.release_date+7,'release_label','New confirmed date');
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'change_candidate',claim,'Official postponement','Only Switch 2 Japan is delayed');
 if (select release_date from public.game_releases where id=r.id)<>r.release_date then raise exception 'Candidate changed public schedule'; end if;
 c:=public.resolve_game_release_check(c.id,r.updated_at,'apply');
 retry:=public.resolve_game_release_check(c.id,r.updated_at,'apply');
 if c.resolution<>'applied' or retry.id<>c.id then raise exception 'Resolution failed'; end if;
 if (select release_date from public.game_releases where id=r.id)<>r.release_date+7 then raise exception 'New day not saved'; end if;
 if exists(select 1 from public.game_releases where id in ('00000000-0000-0000-0000-000000000922','00000000-0000-0000-0000-000000000923') and release_date<>r.release_date) then raise exception 'Other machine/region changed'; end if;
 if (select count(*) from public.game_release_history where release_id=r.id)<>1 then raise exception 'Audit not exactly once'; end if;
 if not exists(select 1 from public.game_release_history where release_id=r.id and (before_values->>'release_date')::date=r.release_date and (after_values->>'release_date')::date=r.release_date+7) then raise exception 'Old date lost'; end if;
 if exists(select 1 from public.list_game_release_rechecks(100) where release_id=r.id) then raise exception 'Applied confirmation not cooled down'; end if;

 select * into r from public.game_releases where id=r.id;
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'change_candidate','{"status":"delayed","release_date":null,"date_precision":"unknown","release_label":"延期・新日程未定"}','Indefinite delay','Publisher postponed without a new day');
 perform public.resolve_game_release_check(c.id,r.updated_at,'apply');
 if exists(select 1 from public.game_releases where id=r.id and status in ('announced','released') and date_precision='day') then raise exception 'Indefinite delay stayed on calendar'; end if;
 if (select release_date from public.game_releases where id=r.id) is not null then raise exception 'Unknown date fabricated'; end if;

 select * into r from public.game_releases where id='00000000-0000-0000-0000-000000000922';
 claim:=jsonb_build_object('status','announced','release_date',r.release_date+1,'date_precision','day','release_label','Changed');
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'change_candidate',claim,'Date changed','Official evidence');
 update public.game_releases set release_label='Human edit' where id=r.id;
 failed:=false;
 begin perform public.resolve_game_release_check(c.id,r.updated_at,'apply'); exception when serialization_failure then failed:=true; end;
 if not failed or (select release_label from public.game_releases where id=r.id)<>'Human edit' then raise exception 'Human edit overwritten'; end if;
 perform public.resolve_game_release_check(c.id,r.updated_at,'reject');

 select * into r from public.game_releases where id=r.id;
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'change_candidate',claim,'Date changed','Official evidence');
 update public.game_sources set review_status='rejected',verified_at=null where id=r.source_id;
 failed:=false;
 begin perform public.resolve_game_release_check(c.id,r.updated_at,'apply'); exception when unique_violation then failed:=true; end;
 if not failed then raise exception 'Revoked evidence applied'; end if;
 update public.game_sources set review_status='verified',verified_at=now() where id=r.source_id;
 perform public.resolve_game_release_check(c.id,r.updated_at,'reject');
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'ambiguous',null,'Timezone uncertain','Do not treat UTC display as Japan');
 c:=public.record_game_release_check(gen_random_uuid(),r.id,r.updated_at,r.source_id,'unavailable',null,'Fetch failed','Could not read original');
 if (select release_date from public.game_releases where id=r.id)<>r.release_date then raise exception 'Failed fetch changed date'; end if;
end;
$$;
reset role;
do $$
declare role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
   if has_table_privilege(role_name,'public.game_release_checks','select') or has_table_privilege(role_name,'public.game_release_history','select')
     or has_function_privilege(role_name,'public.resolve_game_release_check(uuid,timestamptz,text)','execute') then raise exception 'Public maintenance privilege'; end if;
 end loop;
 if has_table_privilege('service_role','public.game_release_history','update') or has_table_privilege('service_role','public.game_release_history','delete') then raise exception 'Mutable audit'; end if;
 if exists(select 1 from pg_proc where proname in ('record_game_release_check','resolve_game_release_check','list_game_release_rechecks','capture_game_release_history') and prosecdef) then raise exception 'Unexpected definer'; end if;
 if exists(select 1 from pg_class where oid in ('public.game_release_checks'::regclass,'public.game_release_history'::regclass) and not relrowsecurity) then raise exception 'RLS missing'; end if;
end;
$$;
rollback;
