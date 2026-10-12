-- Real repository functions and AUD DO are loaded by driver.sql first.
-- Fixture expectations below are constants, never substitutes for SQL results.
\set ON_ERROR_STOP on
DO $runtime$
BEGIN
  IF current_setting('server_version_num')::integer <> 170009 THEN
    RAISE EXCEPTION 'NC_REPLAY_RUNTIME: expected PostgreSQL 17.9';
  END IF;
  IF inet_server_addr() IS DISTINCT FROM '127.0.0.1'::inet THEN
    RAISE EXCEPTION 'NC_REPLAY_ENDPOINT: expected loopback';
  END IF;
  IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('_nc_aplicadas_moneda_factura', '_saldo_factura_calc')
      AND pg_get_functiondef(oid) LIKE '%nc.estado IN (''Timbrada'',''Aplicada'')%') <> 2 THEN
    RAISE EXCEPTION 'NC_REPLAY_AUD: historical DO did not update both fixture functions';
  END IF;
END
$runtime$;

CREATE TEMP TABLE fixture_cases (
  case_id integer PRIMARY KEY, label text UNIQUE, factura_id uuid UNIQUE,
  total numeric, factura_moneda text, factura_tc numeric, factura_estado public.estado_factura,
  factura_deleted boolean, factura_exists boolean,
  nc_monto numeric, nc_moneda text, nc_tc numeric, nc_estado text, nc_deleted boolean,
  expected_inner numeric, expected_old_public numeric, expected_saldo numeric
);
INSERT INTO fixture_cases VALUES
  (1,'timbrada_mxn','00000000-0000-0000-0000-000000000001',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',false,25,0,75),
  (2,'aplicada_mxn','00000000-0000-0000-0000-000000000002',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Aplicada',false,25,25,75),
  (3,'nc_borrador','00000000-0000-0000-0000-000000000003',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Borrador',false,0,0,100),
  (4,'nc_cancelada','00000000-0000-0000-0000-000000000004',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Cancelada',false,0,0,100),
  (5,'nc_deleted','00000000-0000-0000-0000-000000000005',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',true,0,0,100),
  (6,'usd1_tc20_to_mxn','00000000-0000-0000-0000-000000000006',100,'MXN',1,'Emitida',false,true,1,'USD',20,'Timbrada',false,20,0,80),
  (7,'mxn20_to_usd_tc20','00000000-0000-0000-0000-000000000007',100,'USD',20,'Emitida',false,true,20,'MXN',1,'Timbrada',false,1,0,99),
  (8,'eur1_tc24_to_usd_tc20','00000000-0000-0000-0000-000000000008',100,'USD',20,'Emitida',false,true,1,'EUR',24,'Timbrada',false,1.2,0,98.8),
  (9,'nc_fx_missing','00000000-0000-0000-0000-000000000009',100,'MXN',1,'Emitida',false,true,1,'USD',null,'Timbrada',false,0,0,100),
  (10,'nc_fx_one','00000000-0000-0000-0000-000000000010',100,'MXN',1,'Emitida',false,true,1,'USD',1,'Timbrada',false,0,0,100),
  (11,'factura_fx_missing','00000000-0000-0000-0000-000000000011',100,'USD',null,'Emitida',false,true,20,'MXN',1,'Timbrada',false,0,0,100),
  (12,'factura_fx_one','00000000-0000-0000-0000-000000000012',100,'USD',1,'Emitida',false,true,20,'MXN',1,'Timbrada',false,0,0,100),
  (13,'factura_deleted','00000000-0000-0000-0000-000000000013',100,'MXN',1,'Emitida',true,true,25,'MXN',1,'Timbrada',false,25,0,0),
  (14,'factura_cancelada','00000000-0000-0000-0000-000000000014',100,'MXN',1,'Cancelada',false,true,25,'MXN',1,'Timbrada',false,25,0,0),
  (15,'factura_sustituida','00000000-0000-0000-0000-000000000015',100,'MXN',1,'Sustituida',false,true,25,'MXN',1,'Timbrada',false,25,0,0),
  (16,'factura_missing','00000000-0000-0000-0000-000000000016',100,'MXN',1,'Emitida',false,false,25,'MXN',1,'Timbrada',false,0,0,0),
  (17,'timbrada_plus_aplicada','00000000-0000-0000-0000-000000000017',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',false,35,10,65),
  (18,'payment_active','00000000-0000-0000-0000-000000000018',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',false,25,0,35),
  (19,'payment_rep_cancelado','00000000-0000-0000-0000-000000000019',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',false,25,0,75),
  (20,'payment_deleted','00000000-0000-0000-0000-000000000020',100,'MXN',1,'Emitida',false,true,25,'MXN',1,'Timbrada',false,25,0,75),
  (21,'same_usd_no_fx_needed','00000000-0000-0000-0000-000000000021',100,'USD',null,'Emitida',false,true,25,'USD',null,'Timbrada',false,25,0,75),
  (22,'nc_null_amount','00000000-0000-0000-0000-000000000022',100,'MXN',1,'Emitida',false,true,null,'MXN',1,'Timbrada',false,0,0,100);

INSERT INTO public.facturas
SELECT factura_id,total,factura_moneda,factura_tc,factura_estado,
       CASE WHEN factura_deleted THEN '2026-10-12 00:00:00+00'::timestamptz END
FROM fixture_cases WHERE factura_exists;
INSERT INTO public.factura_notas_credito
SELECT factura_id,factura_id,nc_monto,nc_moneda,nc_tc,nc_estado,
       CASE WHEN nc_deleted THEN '2026-10-12 00:00:00+00'::timestamptz END
FROM fixture_cases;
INSERT INTO public.factura_notas_credito VALUES
 ('10000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000017',10,'MXN',1,'Aplicada',null);
INSERT INTO public.pagos_factura VALUES
 ('20000000-0000-0000-0000-000000000018','00000000-0000-0000-0000-000000000018',40,null,'Timbrado'),
 ('20000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000019',40,null,' cancelado '),
 ('20000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000020',40,'2026-10-12 00:00:00+00','Timbrado');

CREATE TEMP TABLE fixture_results (
 phase text, label text, actual_inner numeric, actual_public numeric, actual_saldo numeric,
 expected_inner numeric, expected_public numeric, expected_saldo numeric,
 passed boolean NOT NULL, PRIMARY KEY(phase,label)
);
CREATE FUNCTION pg_temp.capture_cases(p_phase text) RETURNS void LANGUAGE plpgsql AS $capture$
DECLARE c record; i numeric; p numeric; s numeric; e numeric;
BEGIN
  FOR c IN SELECT * FROM fixture_cases ORDER BY case_id LOOP
    i := public._nc_aplicadas_moneda_factura(c.factura_id);
    p := public.nc_aplicadas_en_moneda_factura(c.factura_id);
    s := public._saldo_factura_calc(c.factura_id);
    e := CASE WHEN p_phase = 'before' THEN c.expected_old_public ELSE c.expected_inner END;
    INSERT INTO fixture_results VALUES (p_phase,c.label,i,p,s,c.expected_inner,e,c.expected_saldo,
      i IS NOT DISTINCT FROM c.expected_inner AND p IS NOT DISTINCT FROM e AND s IS NOT DISTINCT FROM c.expected_saldo);
  END LOOP;
END
$capture$;
CREATE FUNCTION pg_temp.capture_transition(p_phase text) RETURNS void LANGUAGE plpgsql AS $transition$
DECLARE i numeric; p numeric; s numeric;
BEGIN
  UPDATE public.factura_notas_credito SET estado='Aplicada' WHERE id='00000000-0000-0000-0000-000000000001';
  i := public._nc_aplicadas_moneda_factura('00000000-0000-0000-0000-000000000001');
  p := public.nc_aplicadas_en_moneda_factura('00000000-0000-0000-0000-000000000001');
  s := public._saldo_factura_calc('00000000-0000-0000-0000-000000000001');
  INSERT INTO fixture_results VALUES (p_phase,'transition_timbrada_to_aplicada',i,p,s,25,25,75,
    i IS NOT DISTINCT FROM 25::numeric AND p IS NOT DISTINCT FROM 25::numeric AND s IS NOT DISTINCT FROM 75::numeric);
  UPDATE public.factura_notas_credito SET estado='Timbrada' WHERE id='00000000-0000-0000-0000-000000000001';
  UPDATE public.factura_notas_credito SET deleted_at='2026-10-12 00:00:00+00' WHERE id='00000000-0000-0000-0000-000000000001';
  i := public._nc_aplicadas_moneda_factura('00000000-0000-0000-0000-000000000001');
  p := public.nc_aplicadas_en_moneda_factura('00000000-0000-0000-0000-000000000001');
  s := public._saldo_factura_calc('00000000-0000-0000-0000-000000000001');
  INSERT INTO fixture_results VALUES (p_phase,'transition_active_to_deleted',i,p,s,0,0,100,
    i IS NOT DISTINCT FROM 0::numeric AND p IS NOT DISTINCT FROM 0::numeric AND s IS NOT DISTINCT FROM 100::numeric);
  UPDATE public.factura_notas_credito SET deleted_at=null WHERE id='00000000-0000-0000-0000-000000000001';
END
$transition$;
SELECT pg_temp.capture_cases('before');
SELECT pg_temp.capture_transition('before');

CREATE TEMP TABLE fixture_meta_before AS
SELECT p.proname AS name,p.oid,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,
       p.proconfig::text AS config,p.provolatile,p.prosecdef,
       encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_denied
FROM pg_proc p WHERE p.oid IN ('public._nc_aplicadas_moneda_factura(uuid)'::regprocedure,
  'public.nc_aplicadas_en_moneda_factura(uuid)'::regprocedure,'public._saldo_factura_calc(uuid)'::regprocedure);
CREATE FUNCTION pg_temp.fixture_data_hash() RETURNS text LANGUAGE sql AS $datahash$
 SELECT encode(sha256(convert_to(jsonb_build_object(
 'facturas',(SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.facturas f),
 'notas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM public.factura_notas_credito n),
 'pagos',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.pagos_factura p))::text,'UTF8')),'hex')
$datahash$;
CREATE TEMP TABLE fixture_data_before AS SELECT pg_temp.fixture_data_hash() AS sha256;

-- Candidate is the complete forward migration/ACL. Runner owns the transaction.
\ir forward.sql

CREATE TEMP TABLE fixture_meta_after AS
SELECT p.proname AS name,p.oid,pg_get_userbyid(p.proowner) AS owner,p.proacl::text AS acl,
       p.proconfig::text AS config,p.provolatile,p.prosecdef,
       encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute,
       NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_denied
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname IN
 ('_nc_aplicadas_moneda_factura','nc_aplicadas_en_moneda_factura','_saldo_factura_calc');
CREATE TEMP TABLE fixture_metadata_results AS
SELECT b.name,b.oid AS before_oid,a.oid AS after_oid,b.owner AS before_owner,a.owner AS after_owner,
 b.acl AS before_acl,a.acl AS after_acl,b.config AS before_config,a.config AS after_config,
 b.provolatile AS before_volatility,a.provolatile AS after_volatility,
 b.prosecdef AS before_definer,a.prosecdef AS after_definer,
 b.definition_sha256 AS before_definition_sha256,a.definition_sha256 AS after_definition_sha256,
 (b.oid=a.oid AND b.owner=a.owner AND b.acl IS NOT DISTINCT FROM a.acl
  AND b.config IS NOT DISTINCT FROM a.config AND b.provolatile=a.provolatile AND b.prosecdef=a.prosecdef
  AND b.anon_execute=a.anon_execute AND b.authenticated_execute=a.authenticated_execute
  AND b.service_execute=a.service_execute AND b.public_denied=a.public_denied) AS preserved,
 (b.owner='postgres' AND b.config='{search_path=public}' AND b.provolatile='s'
  AND b.prosecdef=(b.name<>'_nc_aplicadas_moneda_factura') AND NOT b.anon_execute
  AND b.authenticated_execute=(b.name='_nc_aplicadas_moneda_factura')
  AND b.service_execute AND b.public_denied) AS expected_fixture_security,
 (b.name<>'_nc_aplicadas_moneda_factura' OR b.definition_sha256=a.definition_sha256) AS inner_body_unchanged
FROM fixture_meta_before b FULL JOIN fixture_meta_after a USING(name);
SELECT pg_temp.capture_cases('after');
SELECT pg_temp.capture_transition('after');

DO $assert$
DECLARE failures text;
BEGIN
  SELECT string_agg(phase||':'||label,', ' ORDER BY phase,label) INTO failures FROM fixture_results WHERE NOT passed;
  IF failures IS NOT NULL THEN RAISE EXCEPTION 'NC_REPLAY_CASE_FAILURE: %',failures; END IF;
  IF (SELECT count(*) FROM fixture_results WHERE phase='before' AND actual_inner<>actual_public) < 1 THEN
    RAISE EXCEPTION 'NC_REPLAY_REPRODUCTION: historical public helper did not demonstrate mismatch';
  END IF;
  IF EXISTS(SELECT 1 FROM fixture_results WHERE phase='after' AND actual_inner IS DISTINCT FROM actual_public) THEN
    RAISE EXCEPTION 'NC_REPLAY_PARITY: candidate helpers disagree';
  END IF;
  IF (SELECT count(*) FROM fixture_results) <> 48 THEN RAISE EXCEPTION 'NC_REPLAY_COUNT: expected 48 case-phase results'; END IF;
  IF (SELECT count(*) FROM fixture_metadata_results) <> 3 OR EXISTS
    (SELECT 1 FROM fixture_metadata_results WHERE preserved IS DISTINCT FROM true
     OR expected_fixture_security IS DISTINCT FROM true OR inner_body_unchanged IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'NC_REPLAY_METADATA: OID/owner/ACL/config/security/inner body changed';
  END IF;
  IF (SELECT sha256 FROM fixture_data_before) IS DISTINCT FROM pg_temp.fixture_data_hash() THEN
    RAISE EXCEPTION 'NC_REPLAY_NO_DML: fixture data changed';
  END IF;
  RAISE NOTICE 'NC_PUBLICA_REPLAY_MATRIX_PASS';
END
$assert$;
COPY (SELECT * FROM fixture_results ORDER BY phase,label) TO :'results_path' WITH(FORMAT csv,HEADER);
COPY (SELECT * FROM fixture_metadata_results ORDER BY name) TO :'metadata_path' WITH(FORMAT csv,HEADER);
COPY (SELECT jsonb_build_object('status','pass','postgres',current_setting('server_version'),
 'scope','minimal isolated SQL reproduction','cases_per_phase',24,'case_phase_results',48,
 'before_expected_mismatches',(SELECT count(*) FROM fixture_results WHERE phase='before' AND actual_inner<>actual_public),
 'after_mismatches',(SELECT count(*) FROM fixture_results WHERE phase='after' AND actual_inner<>actual_public),
 'case_failures',(SELECT count(*) FROM fixture_results WHERE NOT passed),
 'metadata_preserved',true,'inner_definition_unchanged',true,'data_unchanged',true,
 'data_sha256',pg_temp.fixture_data_hash())::text) TO :'summary_path';
SELECT phase,count(*) AS cases,count(*) FILTER(WHERE passed) AS passed,
 count(*) FILTER(WHERE actual_inner<>actual_public) AS observed_mismatches FROM fixture_results GROUP BY phase ORDER BY phase;
