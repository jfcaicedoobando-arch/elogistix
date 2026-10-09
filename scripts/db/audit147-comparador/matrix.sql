BEGIN;
CREATE TEMP TABLE before_meta AS SELECT c.oid,c.reltype,c.relowner,c.relacl::text,c.reloptions FROM pg_class c WHERE c.oid='costeo_tarifas_vigentes_v'::regclass;
CREATE TEMP TABLE before_columns AS SELECT attnum,attname,atttypid,atttypmod FROM pg_attribute WHERE attrelid='costeo_tarifas_vigentes_v'::regclass AND attnum>0 AND NOT attisdropped;
CREATE TEMP TABLE before_rpc AS SELECT oid,prosrc,proacl::text,prosecdef,proconfig,prorettype FROM pg_proc WHERE oid IN ('get_top_tarifas(uuid,uuid,uuid,date,uuid)'::regprocedure,'get_top_tarifas_por_codigo(text,text,text,date,uuid)'::regprocedure);
CREATE TEMP TABLE before_policies AS SELECT * FROM pg_policies WHERE schemaname='public';
CREATE FUNCTION pg_temp.check_it(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',msg; END IF; RAISE NOTICE 'PASS: %',msg; END $$;
INSERT INTO organization_members VALUES ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
INSERT INTO puertos VALUES ('10000000-0000-4000-8000-000000000001','Origin','AAA','MX'),('10000000-0000-4000-8000-000000000002','Destination','BBB','MX');
INSERT INTO tipos_contenedor VALUES ('10000000-0000-4000-8000-000000000003','40HC');
INSERT INTO costeo_rutas VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
INSERT INTO costeo_agentes VALUES ('10000000-0000-4000-8000-000000000005','Agent',0,true);
DO $$ DECLARE n integer; ident uuid; currency text; BEGIN
FOR n IN 1..4 LOOP
 ident:=('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
 currency:=(ARRAY['MXN','USD','EUR','MXN'])[n];
 INSERT INTO navieras VALUES(ident,'Carrier'||n);
 INSERT INTO costeo_navieras_condiciones VALUES(ident,ident,'00000000-0000-4000-8000-000000000001',false,NULL,11,NULL);
 INSERT INTO costeo_tarifas VALUES(ident,'00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005',ident,'10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003','USD',n,11,NULL,current_date-1,current_date+1,'vigente','vigente',NULL,NULL);
 INSERT INTO costeo_naviera_demoras_tarifa VALUES(gen_random_uuid(),ident,'10000000-0000-4000-8000-000000000003',1,CASE WHEN n=4 THEN 5 ELSE 20 END,999,'EUR','00000000-0000-4000-8000-000000000001');
 IF n<4 THEN
 INSERT INTO costeo_naviera_demoras_tarifa VALUES(gen_random_uuid(),ident,'10000000-0000-4000-8000-000000000003',6,CASE WHEN n=3 THEN NULL ELSE 10 END,CASE WHEN n=3 THEN 0 ELSE 7 END,currency,'00000000-0000-4000-8000-000000000001');
 END IF;
END LOOP;
END $$;
CREATE TEMP TABLE before_rows AS SELECT id,to_jsonb(v) AS row FROM costeo_tarifas_vigentes_v v;
\i supabase/migrations/20261009192000_audit147_comparador_moneda_tramo.sql
SELECT pg_temp.check_it((SELECT row(oid,reltype,relowner,relacl::text,reloptions) FROM pg_class WHERE oid='costeo_tarifas_vigentes_v'::regclass)=(SELECT row(oid,reltype,relowner,relacl,reloptions) FROM before_meta),'view OID, rowtype, owner, ACL and security_invoker unchanged');
SELECT pg_temp.check_it(NOT EXISTS(SELECT * FROM before_columns EXCEPT SELECT attnum,attname,atttypid,atttypmod FROM pg_attribute WHERE attrelid='costeo_tarifas_vigentes_v'::regclass),'every prior column name, position and type preserved');
SELECT pg_temp.check_it((SELECT count(*) FROM pg_attribute WHERE attrelid='costeo_tarifas_vigentes_v'::regclass AND attnum>0 AND NOT attisdropped)=(SELECT count(*)+3 FROM before_columns),'only three columns appended');
SELECT pg_temp.check_it(NOT EXISTS(SELECT * FROM before_rpc EXCEPT SELECT oid,prosrc,proacl::text,prosecdef,proconfig,prorettype FROM pg_proc),'RPC source, ACL and return type unchanged');
SELECT pg_temp.check_it(NOT EXISTS(SELECT * FROM before_policies EXCEPT SELECT * FROM pg_policies WHERE schemaname='public'),'RLS policies unchanged');
SELECT pg_temp.check_it(NOT EXISTS(SELECT 1 FROM costeo_tarifas_vigentes_v v JOIN before_rows b USING(id) WHERE (to_jsonb(v)-ARRAY['naviera_demora_moneda','naviera_demora_desde_dia','naviera_demora_hasta_dia'])<>b.row),'all old row values preserved');
SELECT pg_temp.check_it((SELECT naviera_demora_dia_6=7 AND naviera_demora_moneda='MXN' AND naviera_demora_desde_dia=6 AND naviera_demora_hasta_dia=10 FROM costeo_tarifas_vigentes_v WHERE naviera_nombre='Carrier1'),'MXN7 and bracket6-10 from same selected row, not earlier EUR999');
SELECT pg_temp.check_it((SELECT naviera_demora_dia_6=7 AND naviera_demora_moneda='USD' FROM costeo_tarifas_vigentes_v WHERE naviera_nombre='Carrier2'),'USD remains native7');
SELECT pg_temp.check_it((SELECT naviera_demora_dia_6=0 AND naviera_demora_moneda='EUR' AND naviera_demora_hasta_dia IS NULL FROM costeo_tarifas_vigentes_v WHERE naviera_nombre='Carrier3'),'zero EUR and open range preserved');
SELECT pg_temp.check_it((SELECT naviera_demora_dia_6 IS NULL AND naviera_demora_moneda IS NULL AND naviera_demora_desde_dia IS NULL AND naviera_demora_hasta_dia IS NULL FROM costeo_tarifas_vigentes_v WHERE naviera_nombre='Carrier4'),'no day6 bracket yields no fabricated amount/currency/range');
GRANT USAGE ON SCHEMA auth TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT pg_temp.check_it((SELECT count(*) FROM costeo_tarifas_vigentes_v)=4,'member sees own view through security_invoker');
SELECT pg_temp.check_it((SELECT count(*) FROM get_top_tarifas('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',current_date,'00000000-0000-4000-8000-000000000001'))=3,'existing SETOF RPC compiles and returns top3 after append');
SELECT pg_temp.check_it((SELECT count(*) FROM get_top_tarifas_por_codigo('AAA','BBB','40HC',current_date,'00000000-0000-4000-8000-000000000001'))=3,'code-based SETOF RPC also preserves shape and top3');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT pg_temp.check_it((SELECT count(*) FROM costeo_tarifas_vigentes_v)=0,'unrelated user sees no rows through view policy');
SELECT pg_temp.check_it((SELECT count(*) FROM get_top_tarifas('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003',current_date,'00000000-0000-4000-8000-000000000001'))=0,'definer RPC membership predicate remains enforced');
RESET ROLE;
ROLLBACK;
