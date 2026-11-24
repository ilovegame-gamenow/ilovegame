-- Keep the old day-based column temporarily for backwards compatibility.
alter table public.site_settings add column pickup_max_age_hours integer not null default 72 check (pickup_max_age_hours between 1 and 336);
-- The feed now selects the most recently added eligible candidates at read time.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'ilovegame-pickup-rotation';
