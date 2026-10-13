BEGIN;
CREATE TEMP TABLE passed_cases (name text);
CREATE FUNCTION pg_temp.ok(name text, condition boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', name; END IF;
  INSERT INTO passed_cases VALUES (name);
END;
$$;
CREATE FUNCTION pg_temp.rejects(name text, statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE message text;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS message = MESSAGE_TEXT;
  END;
  IF message IS NULL OR message NOT LIKE expected || '%' THEN
    RAISE EXCEPTION 'FAIL: %, expected %, got %', name, expected, message;
  END IF;
  INSERT INTO passed_cases VALUES (name);
END;
$$;
SELECT pg_temp.ok('function identity/ACL/security unchanged', NOT EXISTS (
  SELECT 1 FROM function_metadata m JOIN pg_proc p USING (oid)
  WHERE (m.proowner, m.proacl, m.prosecdef, m.proconfig, m.prorettype)
     IS DISTINCT FROM (p.proowner, p.proacl, p.prosecdef, p.proconfig, p.prorettype)
) AND (SELECT count(*) FROM function_metadata m JOIN pg_proc p USING (oid)) = 3);

INSERT INTO auth.users VALUES ('10000000-0000-0000-0000-000000000001', 'fixture@example.invalid');
INSERT INTO organization_members VALUES ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'contador');
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
INSERT INTO facturas (id, organization_id, numero, estado, uuid_fiscal, deleted_at) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'LIVE', 'Emitida', 'UUID-LIVE', NULL),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'DELETED', 'Emitida', 'UUID-DELETED', now()),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'DRAFT', 'Borrador', NULL, NULL),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'FOREIGN', 'Emitida', 'UUID-FOREIGN', NULL),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'CANCELLED', 'Cancelada', 'UUID-CANCELLED', NULL);

-- NC manual/non-array/empty must all check the same parent before lineage logic.
DO $$ DECLARE c jsonb; BEGIN
  FOREACH c IN ARRAY ARRAY['[]'::jsonb, '[{"descripcion":"Manual","cantidad":1,"precio_unitario":1}]'::jsonb, 'null'::jsonb] LOOP
    PERFORM pg_temp.rejects('NC deleted parent ' || c::text, format(
      'INSERT INTO factura_notas_credito (factura_id,organization_id,conceptos) VALUES (%L,%L,%L)',
      '30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',c), 'LC_NC_FACTURA_NO_VIVA');
  END LOOP;
END $$;
SELECT pg_temp.rejects('NC foreign parent', $$INSERT INTO factura_notas_credito (factura_id,organization_id) VALUES ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001')$$, 'LC_NC_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('NC missing parent', $$INSERT INTO factura_notas_credito (factura_id,organization_id) VALUES ('30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000001')$$, 'LC_NC_FACTURA_NO_VIVA');
INSERT INTO factura_notas_credito (id,factura_id,organization_id,conceptos) VALUES
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','[{"descripcion":"Manual","cantidad":1,"precio_unitario":1}]'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','[]');
SELECT pg_temp.ok('NC live invoice and live draft allowed', (SELECT count(*) FROM factura_notas_credito)=2);
SELECT pg_temp.rejects('NC rebind deleted parent', $$UPDATE factura_notas_credito SET factura_id='30000000-0000-0000-0000-000000000002' WHERE id='40000000-0000-0000-0000-000000000001'$$, 'LC_NC_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('NC tenant mutation', $$UPDATE factura_notas_credito SET organization_id='20000000-0000-0000-0000-000000000002' WHERE id='40000000-0000-0000-0000-000000000001'$$, 'LC_NC_FACTURA_NO_VIVA');
INSERT INTO factura_notas_credito (id,factura_id,organization_id,deleted_at) VALUES
 ('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',now());
SELECT pg_temp.rejects('NC restore deleted parent', $$UPDATE factura_notas_credito SET deleted_at=NULL WHERE id='40000000-0000-0000-0000-000000000003'$$, 'LC_NC_FACTURA_NO_VIVA');
SELECT pg_temp.ok('historical NC remains readable', (SELECT count(*) FROM factura_notas_credito WHERE deleted_at IS NOT NULL)=1);
INSERT INTO conceptos_factura(id,factura_id,organization_id,cantidad,precio_unitario,descripcion) VALUES
 ('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,100,'Original');
INSERT INTO factura_notas_credito(factura_id,organization_id,conceptos) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','[{"concepto_factura_id":"50000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":10}]');
SELECT pg_temp.ok('NC valid lineage remains allowed', (SELECT count(*) FROM factura_notas_credito)=4);
SELECT pg_temp.rejects('NC foreign lineage remains rejected', $$INSERT INTO factura_notas_credito(factura_id,organization_id,conceptos) VALUES ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','[{"concepto_factura_id":"50000000-0000-0000-0000-000000000001","cantidad":1,"precio_unitario":1}]')$$, 'LC_NC_LINAJE_INVALIDO');

SELECT pg_temp.rejects('REP deleted parent claim', $$INSERT INTO pagos_factura(factura_id,organization_id,facturapi_rep_id) VALUES ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','PENDING:fixture')$$, 'LC_REP_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('REP foreign parent', $$INSERT INTO pagos_factura(factura_id,organization_id,uuid_rep) VALUES ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','REP')$$, 'LC_REP_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('REP missing parent', $$INSERT INTO pagos_factura(factura_id,organization_id,uuid_rep) VALUES ('30000000-0000-0000-0000-000000000099','20000000-0000-0000-0000-000000000001','REP')$$, 'LC_REP_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('REP unstamped draft', $$INSERT INTO pagos_factura(factura_id,organization_id,uuid_rep) VALUES ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','REP')$$, 'LC_REP_FACTURA_SIN_TIMBRAR');
SELECT pg_temp.rejects('REP cancelled parent', $$INSERT INTO pagos_factura(factura_id,organization_id,uuid_rep) VALUES ('30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','REP')$$, 'LC_REP_FACTURA_NO_VIVA');
INSERT INTO pagos_factura(id,factura_id,organization_id,facturapi_rep_id) VALUES
 ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','PENDING:fixture');
SELECT pg_temp.ok('REP live parent claim allowed', (SELECT count(*) FROM pagos_factura)=1);
SELECT pg_temp.rejects('REP rebind deleted parent', $$UPDATE pagos_factura SET factura_id='30000000-0000-0000-0000-000000000002' WHERE id='60000000-0000-0000-0000-000000000001'$$, 'LC_REP_FACTURA_NO_VIVA');
SELECT pg_temp.rejects('REP tenant mutation', $$UPDATE pagos_factura SET organization_id='20000000-0000-0000-0000-000000000002' WHERE id='60000000-0000-0000-0000-000000000001'$$, 'LC_REP_FACTURA_NO_VIVA');
INSERT INTO pagos_factura(factura_id,organization_id,estado_rep) VALUES
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','NoAplica');
SELECT pg_temp.ok('REP guard still skips payments without REP identifiers', (SELECT count(*) FROM pagos_factura)=2);

SELECT pg_temp.rejects('duplicate deleted parent', $$SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000002')$$, 'factura_not_found');
SELECT pg_temp.rejects('duplicate foreign organization', $$SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000004')$$, 'forbidden');
SELECT pg_temp.rejects('duplicate unstamped draft', $$SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000003')$$, 'factura_sin_uuid');
SELECT pg_temp.rejects('duplicate cancelled', $$SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000005')$$, 'factura_ya_cancelada');
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.rejects('duplicate unauthenticated', $$SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000001')$$, 'unauthenticated');
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SELECT duplicar_factura_para_sustitucion('30000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok('duplicate creates live draft and copies manual concept', (SELECT count(*) FROM facturas WHERE sustituye_a='30000000-0000-0000-0000-000000000001' AND estado='Borrador' AND deleted_at IS NULL)=1 AND (SELECT count(*) FROM conceptos_factura)=2);
SELECT pg_temp.ok('deleted original remains historical and unchanged', (SELECT count(*) FROM facturas WHERE deleted_at IS NOT NULL AND sustituida_por IS NULL)=1);
SELECT count(*) AS passed, array_agg(name ORDER BY name) AS cases FROM passed_cases;
ROLLBACK;
