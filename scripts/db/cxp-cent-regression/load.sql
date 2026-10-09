\set ON_ERROR_STOP on
DROP SCHEMA IF EXISTS auth CASCADE;
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
\ir setup.sql
\ir fixtures/dependencies-live.sql
\ir fixtures/recalc-live.sql
;
\ir fixtures/cierre-live.sql
;
INSERT INTO embarques (id,organization_id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
