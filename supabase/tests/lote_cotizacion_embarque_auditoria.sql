-- =============================================================
-- lote_cotizacion_embarque_auditoria.sql · v13.823.392
--
-- Regresiones del lote de auditoría cotización → embarque:
--   · CASO 1: `cotizacion_tiene_costos` responde true para un COORDINADOR
--     LOGÍSTICO de la misma organización (antes la RLS de importes le devolvía
--     0 filas y la pantalla avisaba en falso "no tiene costos cargados").
--   · CASO 2: la misma función responde false para una cotización de OTRA
--     organización (candado multi-tenant vivo).
--   · CASO 3: venta en USD + costo en MXN sin tipo de cambio ⇒
--     LC_COT_TC_REQUERIDO (antes convertía sin TC sellado).
--   · CASO 4: con tipo de cambio capturado, la misma cotización sí convierte y
--     el embarque hereda el TC.
--   · CASO 5: una línea de venta válida + una malformada (cantidad='dos') ⇒
--     LC_COT_VENTA_IMPORTE_INVALIDO con la descripción de la fila, y NO se crea
--     embarque (antes reventaba con "invalid input syntax for type numeric").
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/lote_cotizacion_embarque_auditoria.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org   uuid;
  v_org2  uuid;
  v_uid   uuid := gen_random_uuid();
  v_cli   uuid;
  v_cli2  uuid;
  v_cot   uuid;
  v_cot2  uuid;
  v_emb   uuid;
  v_tc    numeric;
  v_ok    boolean;
  v_msg   text;
  v_embs  integer;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST LOTE COT EMB', 'TLC000000XX0', 'basico', true) RETURNING id INTO v_org;
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST LOTE COT EMB AJENA', 'TLC000000XX1', 'basico', true) RETURNING id INTO v_org2;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'coordinador-lote@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE LOTE', '', 'cli-lote@test.mx') RETURNING id INTO v_cli;
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org2, 'CLIENTE LOTE AJENO', '', 'cli-lote-ajeno@test.mx') RETURNING id INTO v_cli2;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo,
     conceptos_venta)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, v_uid,
          'USD'::public.moneda, 'COT-LOTE-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          jsonb_build_array(jsonb_build_object(
            'descripcion', 'Flete marítimo', 'cantidad', '1',
            'precio_unitario', '1300', 'moneda', 'USD', 'total', '1300')))
  RETURNING id INTO v_cot;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo)
  VALUES (v_org2, v_cli2, 'Aceptada'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda, 'COT-LOTE-0002',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_cot2;

  -- Costo en MXN (sin precio de venta, para no exigir reflejo en conceptos_venta).
  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_cot, v_org, 'Maniobras en destino', 'MXN', 1, 8000, 0);
  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_cot2, v_org2, 'Maniobras ajenas', 'MXN', 1, 5000, 0);

  -- ---------------- CASOS 1 y 2 (existencia de costos, sin exponer montos) ----
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  IF NOT public.cotizacion_tiene_costos(v_cot) THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la coordinadora logística no detecta los costos de su cotización';
  END IF;
  RAISE NOTICE 'CASO 1 OK: la coordinadora logística detecta que la cotización tiene costos';

  IF public.cotizacion_tiene_costos(v_cot2) THEN
    RAISE EXCEPTION 'REGRESION P0: detectó costos de una cotización de otra organización';
  END IF;
  RAISE NOTICE 'CASO 2 OK: los costos de otra organización no se detectan';

  -- ---------------- CASO 3 (TC obligatorio con monedas mezcladas) -------------
  v_ok := false;
  BEGIN
    v_emb := public.crear_embarque_borrador_core(v_cot);
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
    v_ok := v_msg LIKE '%LC_COT_TC_REQUERIDO%';
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: se esperaba LC_COT_TC_REQUERIDO, se obtuvo: %', COALESCE(v_msg, 'sin error');
  END IF;
  RAISE NOTICE 'CASO 3 OK: venta USD + costo MXN sin TC queda rechazada';

  -- ---------------- CASO 4 (con TC sí convierte y lo hereda) -----------------
  UPDATE public.cotizaciones SET tipo_cambio_usd = 17.5 WHERE id = v_cot;
  v_emb := public.crear_embarque_borrador_core(v_cot);
  SELECT tipo_cambio_usd INTO v_tc FROM public.embarques WHERE id = v_emb;
  IF COALESCE(v_tc, 0) <> 17.5 THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: el embarque no heredó el tipo de cambio (%).', v_tc;
  END IF;
  RAISE NOTICE 'CASO 4 OK: con TC capturado convierte y el embarque lo hereda';

  -- ---------------- CASO 5 (línea de venta malformada) -----------------------
  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo,
     conceptos_venta)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda, 'COT-LOTE-0003',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          jsonb_build_array(
            jsonb_build_object('descripcion', 'Flete válido', 'cantidad', '1',
                               'precio_unitario', '1000', 'moneda', 'MXN', 'total', '1000'),
            jsonb_build_object('descripcion', 'Maniobra legacy', 'cantidad', 'dos',
                               'precio_unitario', '500', 'moneda', 'MXN')))
  RETURNING id INTO v_cot2;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_cot2, v_org, 'Flete', 'MXN', 1, 700, 0);

  v_ok := false;
  BEGIN
    v_emb := public.crear_embarque_borrador_core(v_cot2);
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
    v_ok := v_msg LIKE '%LC_COT_VENTA_IMPORTE_INVALIDO%' AND v_msg LIKE '%Maniobra legacy%';
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: se esperaba LC_COT_VENTA_IMPORTE_INVALIDO con la descripción, se obtuvo: %', COALESCE(v_msg, 'sin error');
  END IF;

  SELECT count(*) INTO v_embs FROM public.embarques WHERE cotizacion_id = v_cot2;
  IF v_embs <> 0 THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: se creó % embarque(s) parcial(es)', v_embs;
  END IF;
  RAISE NOTICE 'CASO 5 OK: la línea malformada se rechaza con regla de negocio y sin embarque parcial';
END;
$$;

ROLLBACK;
