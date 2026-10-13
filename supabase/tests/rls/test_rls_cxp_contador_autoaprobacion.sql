-- Sólo PostgreSQL efímero de CI: fixtures sintéticas y rollback obligatorio.
-- No ejecutar contra bases remotas. La autoaprobación no registra pagos.
BEGIN;
\i supabase/tests/rls/_helpers.sql

-- A diferencia del helper histórico, NULL también falla.
CREATE OR REPLACE FUNCTION pg_temp.cxp_assert(p_ok boolean, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'CXP TEST FAIL: %', p_label; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.cxp_expect_error(p_sql text, p_state text, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_state text; v_message text;
BEGIN
  BEGIN EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  PERFORM pg_temp.cxp_assert(v_state = p_state AND v_message LIKE p_message,
    format('esperaba %s/%s; obtuvo %s/%s', p_state, p_message, v_state, v_message));
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.cxp_fixture(p_org uuid, p_creator uuid, p_concepts boolean DEFAULT true)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_prov uuid := gen_random_uuid(); v_cat uuid := gen_random_uuid(); v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (v_prov, p_org, 'Autoaprobación proveedor efímero', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
    VALUES (v_cat, p_org, 'Autoaprobación administración ' || v_cat::text, 'Administracion');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, proveedor_nombre,
    categoria_presupuesto_id, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd,
    subtotal, total, estado, estado_aprobacion, created_by)
  VALUES (v_id, p_org, v_prov, 'Autoaprobación proveedor efímero', v_cat,
    'AUTO-' || v_id::text, public.fecha_negocio_mx(), 'MXN', 1, 100, 100, 'Vigente', 'pendiente', p_creator);
  IF p_concepts THEN
    INSERT INTO public.proveedor_facturas_conceptos(organization_id, proveedor_factura_id,
      descripcion, cantidad, monto, iva, ieps)
    VALUES (p_org, v_id, 'Gasto sintético', 1, 100, 0, 0);
  END IF;
  RETURN v_id;
END;
$$;

DO $test$
DECLARE
  fx record; v_role text; v_id uuid; v_other uuid; v_version timestamptz;
  v_row public.proveedor_facturas; v_before jsonb; v_payments bigint;
BEGIN
  -- Roles autorizados mantienen aprobación propia, actor e historial.
  FOREACH v_role IN ARRAY ARRAY['contador','admin','admin_org','super_admin'] LOOP
    PERFORM pg_temp.as_postgres();
    SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUTO_' || v_role, v_role);
    v_id := pg_temp.cxp_fixture(fx.org_a, fx.admin_a);
    SELECT updated_at INTO STRICT v_version FROM public.proveedor_facturas WHERE id = v_id;
    SELECT count(*) INTO v_payments FROM public.pagos_proveedor WHERE proveedor_factura_id = v_id;
    PERFORM pg_temp.as_user(fx.admin_a);
    v_row := public.aprobar_factura_proveedor(v_id, true, 'Gasto administrativo sintético', v_version);
    PERFORM pg_temp.cxp_assert(v_row.estado_aprobacion = 'aprobada'
      AND v_row.created_by = fx.admin_a AND v_row.aprobada_por = fx.admin_a
      AND v_row.aprobada_at IS NOT NULL, v_role || ': estado y actores conservados');
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.cxp_assert((SELECT count(*) = 1 FROM public.bitacora_actividad
      WHERE entidad_id = v_id AND accion = 'aprobar_factura_proveedor'
      AND usuario_id = fx.admin_a AND fuente_evento = 'rpc_aprobar_factura_proveedor'),
      v_role || ': exactamente un evento del actor real');
    PERFORM pg_temp.cxp_assert((SELECT count(*) = v_payments FROM public.pagos_proveedor
      WHERE proveedor_factura_id = v_id), v_role || ': aprobación no crea pagos');
  END LOOP;

  PERFORM pg_temp.as_postgres();
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUTO_CONTADOR_CASOS', 'contador');
  v_id := pg_temp.cxp_fixture(fx.org_a, fx.admin_b);
  SELECT updated_at INTO STRICT v_version FROM public.proveedor_facturas WHERE id = v_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  v_row := public.aprobar_factura_proveedor(v_id, true, 'Gasto administrativo sintético', v_version);
  PERFORM pg_temp.cxp_assert(v_row.created_by = fx.admin_b AND v_row.aprobada_por = fx.admin_a,
    'contador conserva aprobación de captura ajena');
  -- Repetición: usa la nueva versión para llegar al guard de estado, sin duplicar.
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_id, 'Gasto administrativo sintético', v_row.updated_at), 'P0001', 'La factura ya fue %');

  PERFORM pg_temp.as_postgres();
  v_id := pg_temp.cxp_fixture(fx.org_a, fx.admin_a);
  SELECT updated_at, to_jsonb(f) INTO STRICT v_version, v_before FROM public.proveedor_facturas f WHERE id = v_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,NULL)',
    v_id, 'Gasto administrativo sintético'), 'PT409', 'LC_CONFLICTO_CONCURRENCIA:%');
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_id, 'Gasto administrativo sintético', v_version - interval '1 second'), 'PT409', 'LC_CONFLICTO_CONCURRENCIA:%');
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,false,%L,%L)',
    v_id, '', v_version), 'P0001', 'Motivo de rechazo requerido');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.cxp_assert((SELECT to_jsonb(f) = v_before FROM public.proveedor_facturas f WHERE id = v_id),
    'CAS y rechazo sin motivo no mutan factura');
  PERFORM pg_temp.as_user(fx.admin_a);
  v_row := public.aprobar_factura_proveedor(v_id, false, 'Rechazo sintético', v_version);
  PERFORM pg_temp.cxp_assert(v_row.estado_aprobacion = 'rechazada' AND v_row.created_by = fx.admin_a
    AND v_row.aprobada_por = fx.admin_a AND v_row.motivo_rechazo = 'Rechazo sintético',
    'rechazo de captura propia conserva motivo y actor');

  -- Membresía sigue exigida aunque el actor sea creador.
  PERFORM pg_temp.as_postgres();
  v_id := pg_temp.cxp_fixture(fx.org_b, fx.admin_a);
  SELECT updated_at INTO STRICT v_version FROM public.proveedor_facturas WHERE id = v_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_id, 'Gasto administrativo sintético', v_version), '42501', 'Factura no encontrada');
  -- La misma organización queda cubierta sólo después de sembrar membresía sintética.
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(fx.org_b,fx.admin_a,'contador');
  PERFORM pg_temp.as_user(fx.admin_a);
  v_row := public.aprobar_factura_proveedor(v_id, true, 'Gasto administrativo sintético', v_version);
  PERFORM pg_temp.cxp_assert(v_row.estado_aprobacion = 'aprobada', 'contador con acceso existente a segunda organización');

  PERFORM pg_temp.as_postgres();
  v_id := pg_temp.cxp_fixture(fx.org_a, fx.admin_a, false);
  SELECT updated_at INTO STRICT v_version FROM public.proveedor_facturas WHERE id = v_id;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_id, 'Gasto administrativo sintético', v_version), 'P0001', 'LC_CXP_SIN_CONCEPTOS:%');
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    gen_random_uuid(), 'Gasto administrativo sintético', v_version), 'P0001', 'Factura no encontrada');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.as_authenticated_sin_uid();
  PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_id, 'Gasto administrativo sintético', v_version), 'P0001', 'No autenticado');

  -- El gate general no se amplía: estos roles siguen rechazados.
  FOREACH v_role IN ARRAY ARRAY['auxiliar_contable','tesorero','vendedor'] LOOP
    PERFORM pg_temp.as_postgres();
    SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('AUTO_DENY_' || v_role, v_role);
    v_id := pg_temp.cxp_fixture(fx.org_a, fx.admin_a);
    SELECT updated_at INTO STRICT v_version FROM public.proveedor_facturas WHERE id = v_id;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.cxp_expect_error(format('SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
      v_id, 'Gasto administrativo sintético', v_version), 'P0001', 'LC_SOD_VIOLATION: Tu rol no puede aprobar%');
  END LOOP;
  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'PASS CxP contador: autoaprobación, otros creadores, roles, membresía, CAS, validación, rechazo, actores y pagos';
END;
$test$;
ROLLBACK;
