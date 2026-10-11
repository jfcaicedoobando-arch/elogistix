-- Sólo fixtures sintéticos sobre PG17 efímero con replay completo. ROLLBACK.
-- No ejecutar contra datos reales. Sin GRANT/REVOKE ni cambios de políticas.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
INSERT INTO auth.users(id,email) VALUES(gen_random_uuid(),'proforma-cancelada-fixture-lock@example.invalid');

CREATE FUNCTION pg_temp.expect_cancelada(p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_error text;
BEGIN
  BEGIN EXECUTE p_sql; EXCEPTION WHEN OTHERS THEN v_error := SQLERRM; END;
  IF v_error IS NULL OR v_error NOT LIKE 'LC_PROFORMA_CANCELADA%' THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_TEST: acción permitida o error inesperado: % / %', p_sql, v_error;
  END IF;
END $$;

DO $fixture$
DECLARE
  v_org uuid := gen_random_uuid();
  v_uid uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_emb uuid := gen_random_uuid();
  v_pending uuid := gen_random_uuid();
  v_accepted uuid := gen_random_uuid();
  v_new uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_serie uuid := gen_random_uuid();
  v_before jsonb;
  v_link jsonb;
  v_count integer;
BEGIN
  INSERT INTO public.organizations(id,nombre) VALUES(v_org,'Synthetic canceled proforma actions');
  INSERT INTO auth.users(id,email) VALUES(v_uid,'proforma-cancelada@example.invalid');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(v_org,v_uid,'admin_org');
  INSERT INTO public.user_roles(user_id,role) VALUES(v_uid,'admin_org') ON CONFLICT DO NOTHING;
  INSERT INTO public.clientes(id,organization_id,nombre,email,requiere_autorizacion_proforma)
  VALUES(v_cli,v_org,'Synthetic canceled customer','proforma-cancelada-cliente@example.invalid',false);
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
  VALUES(v_emb,v_org,v_cli,'DEMO-2026-999001','Marítimo','Importación');
  INSERT INTO public.factura_series(id,organization_id,codigo,prefijo) VALUES(v_serie,v_org,'CANCELTEST','CT');
  INSERT INTO public.proformas(id,organization_id,numero,embarque_id,cliente_id,cliente_nombre,expediente,
    estado_proforma,estado_cliente,token_publico,token_expira_at,snapshot_emision)
  VALUES(v_pending,v_org,'TEST-CANCEL-PENDING',v_emb,v_cli,'Synthetic','DEMO-2026-999001',
    'cancelada','pendiente',v_token,now()+interval '30 days','{"historical":true,"total_mxn":116}'),
    (v_accepted,v_org,'TEST-CANCEL-ACCEPTED',v_emb,v_cli,'Synthetic','DEMO-2026-999001',
    'cancelada','aceptada',NULL,NULL,'{"historical":true,"total_mxn":116}'),
    (v_new,v_org,'TEST-NEW-ACTIVE',v_emb,v_cli,'Synthetic','DEMO-2026-999001',
    'pendiente','aceptada',NULL,NULL,NULL);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_uid)::text,true);
  SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) INTO v_before FROM public.proformas p WHERE id IN(v_pending,v_accepted);
  SELECT count(*) INTO v_count FROM public.facturas WHERE organization_id=v_org;

  PERFORM pg_temp.expect_cancelada(format('SELECT public.actualizar_estado_cliente_proforma(%L,''aceptada'','''')',v_pending));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.actualizar_estado_cliente_proforma(%L,''pendiente'','''')',v_accepted));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.actualizar_estado_cliente_proforma(%L,''rechazada'',''Synthetic reason'')',v_pending));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.aceptar_proforma_sin_autorizacion(%L)',v_accepted));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.convertir_proformas_a_factura(ARRAY[%L::uuid],%L,''PPD'',''99'',''G03'')',v_accepted,v_serie));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.convertir_proformas_a_factura(ARRAY[%L::uuid,%L::uuid],%L,''PPD'',''99'',''G03'')',v_accepted,v_new,v_serie));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.consolidar_proformas(%L,%L,''Synthetic'',''DEMO-2026-999001'','''','''',0,%L,ARRAY[%L::uuid,%L::uuid])',v_emb,v_cli,v_org,v_pending,v_new));
  PERFORM pg_temp.expect_cancelada(format('UPDATE public.proformas SET estado_proforma=''pendiente'' WHERE id=%L',v_pending));
  PERFORM pg_temp.expect_cancelada(format('UPDATE public.proformas SET estado_revision=''aprobada'' WHERE id=%L',v_pending));
  PERFORM pg_temp.expect_cancelada(format('UPDATE public.proformas SET token_publico=gen_random_uuid() WHERE id=%L',v_pending));
  PERFORM pg_temp.expect_cancelada(format('INSERT INTO public.facturas(numero,organization_id,cliente_id,proforma_id,fecha_vencimiento) VALUES(''SYNTH-CANCELLED'',%L,%L,%L,current_date)',v_org,v_cli,v_accepted));

  PERFORM set_config('request.jwt.claims','',true);
  PERFORM pg_temp.expect_cancelada(format('SELECT public.portal_responder_por_token(%L,''aceptada'','''')',v_token));
  PERFORM pg_temp.expect_cancelada(format('SELECT public.portal_responder_por_token(%L,''rechazada'',''Synthetic reason'')',v_token));
  v_link := public.portal_obtener_proforma_por_token(v_token);
  IF v_link->>'estado_link' IS DISTINCT FROM 'cancelada'
     OR (v_link->'proforma') ? 'total_mxn' OR (v_link->'proforma') ? 'cliente_nombre'
     OR v_link->'conceptos' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_TEST: portal cancelado expone acciones o detalle';
  END IF;
  IF (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.proformas p WHERE id IN(v_pending,v_accepted)) IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_TEST: se alteró el histórico';
  END IF;
  IF (SELECT count(*) FROM public.facturas WHERE organization_id=v_org) <> v_count THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_TEST: quedó factura huérfana';
  END IF;
  RAISE NOTICE 'PASS canceled actions refuse manual/internal/token/conversion/consolidation/direct writes; history intact';
END $fixture$;
ROLLBACK;
