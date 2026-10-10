-- Only a disposable local/CI PostgreSQL. Synthetic rows; always rollback.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path=public,pg_temp;
SET LOCAL statement_timeout='30s';
CREATE FUNCTION pg_temp.assert(p_ok boolean,p_label text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN IF p_ok IS DISTINCT FROM true THEN
RAISE EXCEPTION 'FAIL %',p_label; END IF; RAISE NOTICE 'PASS %',p_label; END $$;
CREATE FUNCTION pg_temp.reject(p_sql text,p_state text,p_message text) RETURNS void
LANGUAGE plpgsql AS $$ DECLARE caught boolean:=false; code text; message text;
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,message=MESSAGE_TEXT;
   IF code<>p_state OR message NOT LIKE p_message||'%' THEN RAISE; END IF; caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Expected rejection: %',p_sql; END IF;
END $$;
INSERT INTO auth.users(id,email) VALUES
 ('70000000-0000-4000-8000-000000000010','pricing70-subtotal-seller@example.invalid'),
 ('70000000-0000-4000-8000-000000000011','pricing70-subtotal-other@example.invalid'),
 ('70000000-0000-4000-8000-000000000012','pricing70-subtotal-viewer@example.invalid');
INSERT INTO public.organizations(id,nombre) VALUES
 ('70000000-0000-4000-8000-000000000001','Synthetic replay A'),
 ('70000000-0000-4000-8000-000000000002','Synthetic replay B');
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
 ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000010','vendedor'),
 ('70000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000011','vendedor'),
 ('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000012','gerente_visor');
-- organization_members trigger mirrors canonical user_roles.
INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES
 ('70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000001','Synthetic customer A','pricing70-subtotal-client-a@example.invalid'),
 ('70000000-0000-4000-8000-000000000021','70000000-0000-4000-8000-000000000002','Synthetic customer B','pricing70-subtotal-client-b@example.invalid');
INSERT INTO public.proveedores(id,organization_id,nombre,tipo) VALUES
 ('70000000-0000-4000-8000-000000000090','70000000-0000-4000-8000-000000000001','Synthetic forwarder','Agente de Carga');
INSERT INTO public.costeo_agentes(id,organization_id,proveedor_id,nombre) VALUES
 ('70000000-0000-4000-8000-000000000070','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000090','Synthetic agent');
INSERT INTO public.navieras(id,code,name) VALUES ('70000000-0000-4000-8000-000000000091','XQFX','Synthetic carrier');
INSERT INTO public.puertos(id,code,name,country) VALUES
 ('70000000-0000-4000-8000-000000000092','P7SOR','Synthetic origin','ZZ'),
 ('70000000-0000-4000-8000-000000000093','P7SDE','Synthetic destination','ZZ');
INSERT INTO public.costeo_rutas(id,organization_id,puerto_origen_id,puerto_destino_id) VALUES
 ('70000000-0000-4000-8000-000000000094','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000092','70000000-0000-4000-8000-000000000093');
INSERT INTO public.tipos_contenedor(id,code,name) VALUES ('70000000-0000-4000-8000-000000000095','PRICING70_SUBTOTAL_40HC','40 High Cube');
INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,activa) VALUES
 ('70000000-0000-4000-8000-000000000030','70000000-0000-4000-8000-000000000001','Synthetic open','abierta',true);
INSERT INTO public.crm_oportunidades(id,organization_id,nombre,etapa_id,cliente_id,vendedor_id,vendedor_email,moneda) VALUES
 ('70000000-0000-4000-8000-000000000040','70000000-0000-4000-8000-000000000001','Synthetic own opportunity','70000000-0000-4000-8000-000000000030','70000000-0000-4000-8000-000000000020','70000000-0000-4000-8000-000000000010','pricing70-subtotal-seller@example.invalid','MXN');
INSERT INTO public.costeo_tarifas(id,organization_id,agente_id,naviera_id,ruta_id,tipo_contenedor_id,flete_base,vigente_desde,vigente_hasta) VALUES
 ('70000000-0000-4000-8000-000000000060','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000070','70000000-0000-4000-8000-000000000091','70000000-0000-4000-8000-000000000094','70000000-0000-4000-8000-000000000095',100,current_date-1,current_date+10);
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000010","role":"authenticated","email":"pricing70-subtotal-seller@example.invalid"}',true);
INSERT INTO public.crm_solicitudes_pricing(id,organization_id,oportunidad_id,solicitante_id,tipo_carga,servicio,cantidad) VALUES
 ('70000000-0000-4000-8000-000000000050','70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000040','70000000-0000-4000-8000-000000000010','40 HC','Marítimo',1);
UPDATE public.crm_solicitudes_pricing SET tarifa_tarifario_id='70000000-0000-4000-8000-000000000060' WHERE id='70000000-0000-4000-8000-000000000050';
INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,cliente_id,moneda,tarifa_id,oportunidad_id,pricing_solicitud_id)
VALUES ('70000000-0000-4000-8000-000000000080','70000000-0000-4000-8000-000000000001','SYNTHETIC-FX-MXN','Marítimo','Importación','70000000-0000-4000-8000-000000000020','MXN','70000000-0000-4000-8000-000000000060','70000000-0000-4000-8000-000000000040','70000000-0000-4000-8000-000000000050');
INSERT INTO public.cotizaciones(id,organization_id,folio,modo,tipo,cliente_id,moneda,conceptos_venta)
VALUES ('70000000-0000-4000-8000-000000000082','70000000-0000-4000-8000-000000000001','SYNTHETIC-FX-LEGACY','Marítimo','Importación','70000000-0000-4000-8000-000000000020','MXN','[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD"}]');
SELECT pg_temp.assert((SELECT subtotal=0 AND tipo_cambio_usd IS NULL AND conceptos_venta='[]' FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'01 Pricing blank draft needs no fabricated rate');
-- Global catalog codes and synthetic emails above are suite-specific, so
-- the guard can run beside other suites without colliding with common 40HC.
SET LOCAL ROLE authenticated;
DO $fixture_access$
BEGIN
  IF auth.uid() IS DISTINCT FROM '70000000-0000-4000-8000-000000000010'::uuid
     OR NOT public.has_role(auth.uid(),'vendedor'::public.app_role)
     OR public.has_role(auth.uid(),'super_admin'::public.app_role)
     OR (SELECT count(*) FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080')<>1 THEN
    RAISE EXCEPTION 'Pricing subtotal fixture requires its visible same-tenant seller; run the complete CI bootstrap including _ci_post_migrate';
  END IF;
END;
$fixture_access$;
DO $cases$
DECLARE before_q jsonb; before_o jsonb; tc text;
BEGIN
 SELECT to_jsonb(c) INTO before_q FROM public.cotizaciones c WHERE id='70000000-0000-4000-8000-000000000080';
 SELECT to_jsonb(o) INTO before_o FROM public.crm_oportunidades o WHERE id='70000000-0000-4000-8000-000000000040';
 FOREACH tc IN ARRAY ARRAY['NULL','0','-1',quote_literal('NaN'),quote_literal('Infinity'),quote_literal('-Infinity')] LOOP
  PERFORM pg_temp.reject(format('UPDATE public.cotizaciones SET conceptos_venta=''[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD"}]'', tipo_cambio_usd=%s::numeric WHERE id=''70000000-0000-4000-8000-000000000080''',tc),'22023','LC_COT_PRICING_TC_REQUERIDO');
  IF (SELECT to_jsonb(c) FROM public.cotizaciones c WHERE id='70000000-0000-4000-8000-000000000080') IS DISTINCT FROM before_q
     OR (SELECT to_jsonb(o) FROM public.crm_oportunidades o WHERE id='70000000-0000-4000-8000-000000000040') IS DISTINCT FROM before_o THEN
    RAISE EXCEPTION 'Invalid rate % left a partial write',tc;
  END IF;
 END LOOP;
 PERFORM pg_temp.assert(true,'02 Missing zero negative NaN and infinite rates reject atomically');
END;
$cases$;
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD","aplica_iva":true}]',tipo_cambio_usd=20,subtotal=999 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=28.20 AND moneda='MXN' AND tipo_cambio_usd=20 AND conceptos_venta='[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD","aplica_iva":true}]'::jsonb FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'03 Foreign-only USD 1.41 converts to MXN 28.20 without IVA or relabeling');
SELECT pg_temp.assert((SELECT monto_estimado=28.20 AND moneda='MXN' FROM public.crm_oportunidades WHERE id='70000000-0000-4000-8000-000000000040'),'04 CRM observes converted canonical subtotal');
UPDATE public.cotizaciones SET tipo_cambio_usd=25 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=35.25 AND moneda='MXN' FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080') AND (SELECT monto_estimado=35.25 AND moneda='MXN' FROM public.crm_oportunidades WHERE id='70000000-0000-4000-8000-000000000040'),'05 TC-only edit recalculates quote and open opportunity');
DO $$ DECLARE q jsonb; o jsonb; BEGIN
 SELECT to_jsonb(c) INTO q FROM public.cotizaciones c WHERE id='70000000-0000-4000-8000-000000000080';
 SELECT to_jsonb(c) INTO o FROM public.crm_oportunidades c WHERE id='70000000-0000-4000-8000-000000000040';
 PERFORM pg_temp.reject('UPDATE public.cotizaciones SET tipo_cambio_usd=NULL WHERE id=''70000000-0000-4000-8000-000000000080''','22023','LC_COT_PRICING_TC_REQUERIDO');
 PERFORM pg_temp.assert((SELECT to_jsonb(c)=q FROM public.cotizaciones c WHERE id='70000000-0000-4000-8000-000000000080') AND (SELECT to_jsonb(c)=o FROM public.crm_oportunidades c WHERE id='70000000-0000-4000-8000-000000000040'),'06 TC-only invalid edit preserves all quote and CRM fields'); END $$;
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD"},{"cantidad":1,"precio_unitario":10,"moneda":"MXN"}]',tipo_cambio_usd=20 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=38.20 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'07 Mixed-currency MXN header sums both buckets');
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":1.005,"moneda":"USD"},{"cantidad":1,"precio_unitario":1.005,"moneda":"USD"}]',tipo_cambio_usd=1.5 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=3.03 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'08 Canonical helper line rounding then conversion');
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":12,"moneda":"MXN"},{"cantidad":1,"precio_unitario":0,"moneda":"USD"}]',tipo_cambio_usd=NULL WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=12 AND tipo_cambio_usd IS NULL FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'09 Same-currency sale and foreign zero need no rate');
UPDATE public.cotizaciones SET conceptos_venta='[]',subtotal=999 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=0 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'10 Clearing Pricing concepts yields canonical zero');
SELECT pg_temp.assert((SELECT subtotal=1.41 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000082'),'11 Non-Pricing historical nominal fallback is preserved');
UPDATE public.cotizaciones SET tipo_cambio_usd=20 WHERE id='70000000-0000-4000-8000-000000000082';
SELECT pg_temp.assert((SELECT subtotal=1.41 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000082'),'12 Non-Pricing TC-only update does not recalculate');
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD"},{"cantidad":1,"precio_unitario":10,"moneda":"MXN"}]' WHERE id='70000000-0000-4000-8000-000000000082';
SELECT pg_temp.assert((SELECT subtotal=10 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000082'),'13 Non-Pricing mixed bucket preference is preserved');
UPDATE public.cotizaciones SET conceptos_venta='[]',subtotal=123 WHERE id='70000000-0000-4000-8000-000000000082';
SELECT pg_temp.assert((SELECT subtotal=123 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000082'),'14 Non-Pricing empty-concept explicit subtotal is preserved');
SELECT pg_temp.reject('UPDATE public.cotizaciones SET moneda=''USD'' WHERE id=''70000000-0000-4000-8000-000000000080''','22023','LC_COT_PRICING_ORIGEN_CONFIRMADO');
SELECT pg_temp.reject('UPDATE public.cotizaciones SET pricing_solicitud_id=NULL WHERE id=''70000000-0000-4000-8000-000000000080''','22023','LC_COT_PRICING_ORIGEN_CONFIRMADO');
SELECT pg_temp.assert(true,'15 Existing header currency and lineage guard remains immutable');
SELECT pg_temp.reject('UPDATE public.cotizaciones SET conceptos_venta=''[{"cantidad":1,"precio_unitario":1,"moneda":"EUR"}]'' WHERE id=''70000000-0000-4000-8000-000000000080''','23514','LC_COTIZACION_MONEDA_NO_SOPORTADA');
SELECT pg_temp.reject('UPDATE public.cotizaciones SET conceptos_venta=''[{"cantidad":1,"precio_unitario":"NaN","moneda":"USD"}]'' WHERE id=''70000000-0000-4000-8000-000000000080''','23514','LC_COTIZACION_CONCEPTO_INVALIDO');
SELECT pg_temp.assert(true,'16 Unsupported concept currency and nonfinite sales reject');
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000011","role":"authenticated","email":"pricing70-subtotal-other@example.invalid"}',true);
DO $$ DECLARE n int; BEGIN UPDATE public.cotizaciones SET tipo_cambio_usd=999 WHERE id='70000000-0000-4000-8000-000000000080'; GET DIAGNOSTICS n=ROW_COUNT;
PERFORM pg_temp.assert(n=0,'17 Cross-tenant TC mutation remains hidden by RLS'); END $$;
SELECT set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000012","role":"authenticated","email":"pricing70-subtotal-viewer@example.invalid"}',true);
DO $$ DECLARE n int; BEGIN UPDATE public.cotizaciones SET tipo_cambio_usd=999 WHERE id='70000000-0000-4000-8000-000000000080'; GET DIAGNOSTICS n=ROW_COUNT;
PERFORM pg_temp.assert(n=0,'18 Read-only manager cannot mutate the quotation'); END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE n int; BEGIN
 BEGIN UPDATE public.cotizaciones SET tipo_cambio_usd=999 WHERE id='70000000-0000-4000-8000-000000000080'; GET DIAGNOSTICS n=ROW_COUNT;
 EXCEPTION WHEN insufficient_privilege THEN n:=0; END;
 PERFORM pg_temp.assert(n=0,'19 Anonymous mutation affects no row');
END $$;
SET LOCAL ROLE postgres;
SELECT set_config('request.jwt.claims','',true);
INSERT INTO public.crm_etapas_pipeline(id,organization_id,nombre,tipo,activa)
VALUES ('70000000-0000-4000-8000-000000000031','70000000-0000-4000-8000-000000000001','Synthetic won','ganada',true);
UPDATE public.cotizaciones SET conceptos_venta='[{"cantidad":1,"precio_unitario":1.41,"moneda":"USD"}]',tipo_cambio_usd=20 WHERE id='70000000-0000-4000-8000-000000000080';
UPDATE public.cotizaciones SET estado='Aceptada',tipo_cambio_usd=25 WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.assert((SELECT subtotal=35.25 AND estado='Aceptada' FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080') AND (SELECT valor_real=35.25 AND moneda='MXN' FROM public.crm_oportunidades WHERE id='70000000-0000-4000-8000-000000000040'),'20 Combined acceptance and TC sees converted valor_real');
SELECT pg_temp.reject('UPDATE public.cotizaciones SET tipo_cambio_usd=30 WHERE id=''70000000-0000-4000-8000-000000000080''','P0001','LC_COTIZACION_INMUTABLE');
SELECT pg_temp.assert((SELECT tipo_cambio_usd=25 AND subtotal=35.25 FROM public.cotizaciones WHERE id='70000000-0000-4000-8000-000000000080'),'21 Accepted Pricing TC edit cannot bypass amount immutability');
UPDATE public.cotizaciones SET estado='En operación' WHERE id='70000000-0000-4000-8000-000000000080';
SELECT pg_temp.reject('UPDATE public.cotizaciones SET tipo_cambio_usd=30 WHERE id=''70000000-0000-4000-8000-000000000080''','P0001','LC_COTIZACION_INMUTABLE');
SELECT pg_temp.assert(true,'22 In-operation Pricing TC edit remains immutable');
ROLLBACK;
