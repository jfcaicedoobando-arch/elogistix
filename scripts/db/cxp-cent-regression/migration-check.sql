\set ON_ERROR_STOP on
-- Restore reviewed live functions; no financial matrix rerun.
\ir fixtures/recalc-live.sql
;
\ir fixtures/cierre-live.sql
;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres SUPERUSER; END IF; END $$;
ALTER FUNCTION public._recalc_estado_proveedor_factura(uuid) OWNER TO postgres;
ALTER FUNCTION public.validar_cierre_embarque(uuid) OWNER TO postgres;
SET ROLE postgres;
REVOKE ALL ON FUNCTION public._recalc_estado_proveedor_factura(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated,service_role;
RESET ROLE;
SELECT qa_reset();
SELECT qa_invoice(1,0.01,'MXN','Pagada'); -- Must NOT be reopened by installation.
SELECT qa_invoice(2,100,'MXN','Pagada');
SELECT qa_payment(2,99.99);
CREATE OR REPLACE FUNCTION qa_data_snapshot() RETURNS jsonb LANGUAGE plpgsql AS $$ DECLARE t record;r jsonb;v jsonb:='{}'; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
  EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),''[]''::jsonb) FROM public.%I x',t.tablename) INTO r;
  v:=v||jsonb_build_object(t.tablename,r);
 END LOOP; RETURN v; END $$;
CREATE TEMP TABLE before_data AS SELECT qa_data_snapshot() AS snapshot;
CREATE TEMP TABLE before_metadata AS SELECT proname,oid,pg_get_userbyid(proowner) AS owner,proacl,prosecdef,proconfig,md5(prosrc) AS source_md5 FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure);
SELECT 'BEFORE' AS phase,* FROM before_metadata;
\i :candidate_migration
DO $$ BEGIN
 IF (SELECT snapshot FROM before_data) IS DISTINCT FROM qa_data_snapshot() THEN RAISE EXCEPTION 'MIGRATION WROTE FIXTURE TABLE DATA'; END IF;
 IF EXISTS(SELECT 1 FROM before_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (pg_get_userbyid(p.proowner),p.proacl,p.prosecdef,p.proconfig) IS DISTINCT FROM (b.owner,b.proacl,b.prosecdef,b.proconfig)) THEN RAISE EXCEPTION 'MIGRATION METADATA CHANGED'; END IF;
 IF (SELECT count(*) FROM before_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE md5(p.prosrc)<>b.source_md5)<>2 THEN RAISE EXCEPTION 'BOTH DEFINITIONS MUST CHANGE'; END IF;
END $$;
SELECT 'AFTER' AS phase,proname,oid,pg_get_userbyid(proowner) AS owner,proacl,prosecdef,proconfig,md5(prosrc) AS source_md5 FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure);
COPY (SELECT 'before' AS phase,* FROM before_metadata UNION ALL SELECT 'after',proname,oid,pg_get_userbyid(proowner),proacl,prosecdef,proconfig,md5(prosrc) FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure)) TO :'metadata_path' CSV HEADER;
-- Reapplying must reject source drift and leave both candidate definitions/data intact.
CREATE TEMP TABLE after_metadata AS SELECT oid,prosrc,proacl FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure);
\set ON_ERROR_STOP off
\i :candidate_migration
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT snapshot FROM before_data) IS DISTINCT FROM qa_data_snapshot() THEN RAISE EXCEPTION 'REJECTED REAPPLY WROTE DATA'; END IF;
 IF EXISTS(SELECT 1 FROM after_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (p.prosrc,p.proacl) IS DISTINCT FROM (b.prosrc,b.proacl)) THEN RAISE EXCEPTION 'REJECTED REAPPLY CHANGED FUNCTION'; END IF;
END $$;
-- The exact historical squash is accepted without normalizing unknown source.
\ir fixtures/recalc-squash.sql
\ir fixtures/cierre-live.sql
;
DO $$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public._recalc_estado_proveedor_factura(uuid)'::regprocedure) IS DISTINCT FROM 'e105b05e12e94cc27d372ecdbbdd8d1a' THEN RAISE EXCEPTION 'SQUASH FIXTURE HASH DRIFT'; END IF;
END $$;
\i :candidate_migration
DO $$ BEGIN
 IF (SELECT snapshot FROM before_data) IS DISTINCT FROM qa_data_snapshot() THEN RAISE EXCEPTION 'SQUASH INSTALL WROTE DATA'; END IF;
 IF EXISTS(SELECT 1 FROM before_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (pg_get_userbyid(p.proowner),p.proacl,p.prosecdef,p.proconfig) IS DISTINCT FROM (b.owner,b.proacl,b.prosecdef,b.proconfig)) THEN RAISE EXCEPTION 'SQUASH INSTALL METADATA CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM after_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (p.prosrc,p.proacl) IS DISTINCT FROM (b.prosrc,b.proacl)) THEN RAISE EXCEPTION 'SQUASH INSTALL DIFFERS FROM LIVE INSTALL'; END IF;
END $$;
-- Even one additional blank line is unknown source and must reject atomically.
\ir fixtures/recalc-live.sql
;
\ir fixtures/cierre-live.sql
;
DO $$ DECLARE ddl text; BEGIN
 SELECT pg_get_functiondef('public._recalc_estado_proveedor_factura(uuid)'::regprocedure) INTO ddl;
 EXECUTE replace(ddl, E'\nDECLARE', E'\n\nDECLARE');
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public._recalc_estado_proveedor_factura(uuid)'::regprocedure) IN ('e719e55c03aa28b1593cb86695581522','e105b05e12e94cc27d372ecdbbdd8d1a') THEN RAISE EXCEPTION 'UNKNOWN SOURCE FIXTURE NOT MUTATED'; END IF;
END $$;
TRUNCATE after_metadata;
INSERT INTO after_metadata SELECT oid,prosrc,proacl FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure);
\set ON_ERROR_STOP off
\i :candidate_migration
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT snapshot FROM before_data) IS DISTINCT FROM qa_data_snapshot() THEN RAISE EXCEPTION 'REJECTED UNKNOWN SOURCE WROTE DATA'; END IF;
 IF EXISTS(SELECT 1 FROM after_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (p.prosrc,p.proacl) IS DISTINCT FROM (b.prosrc,b.proacl)) THEN RAISE EXCEPTION 'REJECTED UNKNOWN SOURCE CHANGED FUNCTION'; END IF;
END $$;
SELECT 'SQUASH_INSTALL_NO_DML_METADATA_PASS; UNKNOWN_SOURCE_ROLLBACK_PASS' AS result;
-- Restore live bodies but deliberately drift ACL; installer must reject before writes.
\ir fixtures/recalc-live.sql
;
\ir fixtures/cierre-live.sql
;
SET ROLE postgres;
GRANT EXECUTE ON FUNCTION public._recalc_estado_proveedor_factura(uuid) TO authenticated;
RESET ROLE;
TRUNCATE after_metadata;
INSERT INTO after_metadata SELECT oid,prosrc,proacl FROM pg_proc WHERE oid IN ('public._recalc_estado_proveedor_factura(uuid)'::regprocedure,'public.validar_cierre_embarque(uuid)'::regprocedure);
\set ON_ERROR_STOP off
\i :candidate_migration
\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT snapshot FROM before_data) IS DISTINCT FROM qa_data_snapshot() THEN RAISE EXCEPTION 'REJECTED ACL DRIFT WROTE DATA'; END IF;
 IF EXISTS(SELECT 1 FROM after_metadata b JOIN pg_proc p ON p.oid=b.oid WHERE (p.prosrc,p.proacl) IS DISTINCT FROM (b.prosrc,b.proacl)) THEN RAISE EXCEPTION 'REJECTED ACL DRIFT CHANGED FUNCTION'; END IF;
END $$;
SELECT 'MIGRATION_INSTALL_NO_DML_METADATA_PASS; REAPPLY_SOURCE_DRIFT_ROLLBACK_PASS; ACL_DRIFT_ROLLBACK_PASS' AS result;
