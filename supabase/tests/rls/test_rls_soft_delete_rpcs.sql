-- ============================================================================
-- Suite de REGRESIÓN — FIX C5: las RPCs de listado/agregado ignoran borrados
-- ============================================================================
--
-- Contexto: tras REG B-001 (20260728195103) se eliminaron las policies
-- "Hide soft deleted", así que las RPCs SECURITY DEFINER seguían listando y
-- SUMANDO dinero de filas con `deleted_at`. La migración
-- 20260730000003 (FIX C5) añadió el filtro en 9 funciones.
--
-- Este test inserta un embarque + factura + conceptos + documento, verifica
-- que aparecen, los soft-borra y verifica que desaparecen de:
--   embarques_listado, facturas_listado, dashboard_details,
--   sidebar_alert_counts, operaciones_stats, profit_por_cliente,
--   dashboard_summary, operadores_distintos, embarques_list_extras
--
-- Ejecutar:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_soft_delete_rpcs.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. ROLLBACK al final.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  cv_a uuid := gen_random_uuid();
  cc_a uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  n int;
  v_num numeric;
  v_json jsonb;
BEGIN
  -- ----------------------------------------------------------------------
  -- Seed
  -- ----------------------------------------------------------------------
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS C5 A');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_a, user_a, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
  VALUES (cli_a, 'Cli C5 A', 'XAXX010101000', 'c5@test.local', org_a);

  INSERT INTO public.embarques(
    id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo,
    estado, etd, eta, operador, tipo_cambio_usd, tipo_cambio_eur
  ) VALUES (
    emb_a, 'ELCCC00501', cli_a, 'Cli C5 A', org_a, 'Marítimo', 'Importación',
    'Arribo', current_date - 40, current_date - 30, 'OperadorC5', 17.0, 19.0
  );

  INSERT INTO public.conceptos_venta(
    id, embarque_id, descripcion, cantidad, precio_unitario, moneda, total,
    organization_id, estado_facturacion, aplica_iva, tasa_iva_aplicada, origen
  ) VALUES (cv_a, emb_a, 'Flete', 1, 5000, 'USD', 5000, org_a, 'pendiente', false, 0, 'manual');

  INSERT INTO public.conceptos_costo(
    id, embarque_id, proveedor_nombre, concepto, monto, moneda,
    estado_liquidacion, organization_id, tasa_iva_aplicada, origen
  ) VALUES (cc_a, emb_a, 'Prov C5', 'Flete', 1000, 'USD', 'Pendiente', org_a, 0, 'manual');

  INSERT INTO public.documentos_embarque(id, embarque_id, nombre, estado, organization_id)
  VALUES (doc_a, emb_a, 'BL', 'Pendiente', org_a);

  INSERT INTO public.facturas(
    id, numero, cliente_id, cliente_nombre, embarque_id, total, moneda,
    fecha_emision, estado, organization_id
  ) VALUES (
    fac_a, 'F-C5-0001', cli_a, 'Cli C5 A', emb_a, 12345, 'MXN',
    current_date, 'Vencida', org_a
  );

  -- ----------------------------------------------------------------------
  -- ANTES del soft delete: todo debe verse
  -- ----------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);

  SELECT count(*) INTO n FROM public.embarques_listado(org_a) WHERE id = emb_a;
  PERFORM pg_temp.assert(n = 1, 'Fixture: embarques_listado no devuelve el embarque vivo');

  SELECT count(*) INTO n FROM public.facturas_listado(org_a) WHERE id = fac_a;
  PERFORM pg_temp.assert(n = 1, 'Fixture: facturas_listado no devuelve la factura viva');

  SELECT count(*) INTO n FROM public.operadores_distintos() WHERE operador = 'OperadorC5';
  PERFORM pg_temp.assert(n = 1, 'Fixture: operadores_distintos no devuelve el operador vivo');

  SELECT count(*) INTO n FROM public.profit_por_cliente() WHERE cliente_id = cli_a;
  PERFORM pg_temp.assert(n = 1, 'Fixture: profit_por_cliente no devuelve el cliente vivo');

  SELECT count(*) INTO n FROM public.embarques_list_extras(ARRAY[emb_a]) WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 1, 'Fixture: embarques_list_extras no devuelve el embarque vivo');

  SELECT facturas_vencidas INTO n FROM public.sidebar_alert_counts();
  PERFORM pg_temp.assert(n >= 1, 'Fixture: sidebar_alert_counts no cuenta la factura vencida viva');

  -- ----------------------------------------------------------------------
  -- Soft delete de TODA la cascada
  -- ----------------------------------------------------------------------
  PERFORM pg_temp.as_postgres();
  UPDATE public.facturas            SET deleted_at = now() WHERE id = fac_a;
  UPDATE public.conceptos_venta     SET deleted_at = now() WHERE id = cv_a;
  UPDATE public.conceptos_costo     SET deleted_at = now() WHERE id = cc_a;
  UPDATE public.documentos_embarque SET deleted_at = now() WHERE id = doc_a;
  UPDATE public.embarques           SET deleted_at = now() WHERE id = emb_a;

  -- ----------------------------------------------------------------------
  -- DESPUÉS: ninguna RPC debe devolverlo ni sumarlo
  -- ----------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);

  SELECT count(*) INTO n FROM public.embarques_listado(org_a) WHERE id = emb_a;
  PERFORM pg_temp.assert(n = 0, 'C5: embarques_listado devuelve un embarque borrado');

  SELECT count(*) INTO n FROM public.facturas_listado(org_a) WHERE id = fac_a;
  PERFORM pg_temp.assert(n = 0, 'C5: facturas_listado devuelve una factura borrada');

  SELECT count(*) INTO n FROM public.operadores_distintos() WHERE operador = 'OperadorC5';
  PERFORM pg_temp.assert(n = 0, 'C5: operadores_distintos devuelve el operador de un embarque borrado');

  SELECT count(*) INTO n FROM public.profit_por_cliente() WHERE cliente_id = cli_a;
  PERFORM pg_temp.assert(n = 0, 'C5: profit_por_cliente agrega dinero de un embarque borrado');

  SELECT count(*) INTO n FROM public.embarques_list_extras(ARRAY[emb_a]) WHERE embarque_id = emb_a;
  PERFORM pg_temp.assert(n = 0, 'C5: embarques_list_extras devuelve un embarque borrado');

  SELECT facturas_vencidas INTO n FROM public.sidebar_alert_counts();
  PERFORM pg_temp.assert(n = 0, 'C5: sidebar_alert_counts cuenta una factura borrada');

  v_json := public.dashboard_details();
  PERFORM pg_temp.assert(
    (v_json::text NOT LIKE '%ELCCC00501%'),
    'C5: dashboard_details expone un embarque borrado'
  );

  v_json := public.dashboard_summary();
  SELECT COALESCE((v_json->'conteoPorEstado'->>'Arribo')::numeric, 0) INTO v_num;
  PERFORM pg_temp.assert(v_num = 0, 'C5: dashboard_summary cuenta un embarque borrado');

  v_json := public.operaciones_stats();
  PERFORM pg_temp.assert(
    (v_json::text NOT LIKE '%OperadorC5%'),
    'C5: operaciones_stats agrega un embarque borrado'
  );

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ FIX C5 OK — 9 RPCs ignoran filas soft-deleted';
END $$;

ROLLBACK;
