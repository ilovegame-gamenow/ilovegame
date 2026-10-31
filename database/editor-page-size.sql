alter table public.site_settings
  add column editor_page_size integer not null default 20
  check (editor_page_size between 1 and 100);
