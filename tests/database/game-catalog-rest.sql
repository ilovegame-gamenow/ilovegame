-- Test-only bootstrap after game-catalog.sql test suite, in the disposable CI DB.
-- These fixed credentials are deliberately local fixtures, never deployment secrets.
\set ON_ERROR_STOP on
create role catalog_rest_authenticator login password 'catalog_local_test_only' noinherit;
grant anon, authenticated, service_role to catalog_rest_authenticator;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.articles to service_role;
insert into public.articles(id,title) values (7001,'REST integration article'),(7002,'Second REST integration article');
