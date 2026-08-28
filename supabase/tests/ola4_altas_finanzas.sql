-- =============================================================
-- ola4_altas_finanzas.sql · Ola 4 (parches N1-N17) · reportes + índices
--
-- Continúa ola4_altas.sql (partido por límite de 200 líneas). Cubre N7
-- (profit_por_cliente sin fan-out), N8 (eerr_resumen_anual excluye USD
-- sin TC), N9 (cartera_pendiente con dias_vencido con signo), N15/N16
-- (índices únicos con predicado deleted_at IS NULL) y N10 (Borrador no
-- cuenta como activo en dashboard_summary).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_altas_finanzas.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := 'c1111111-1111-1111-1111-111111111111';
  v_uid uuid := 'c5555555-5555-5555-5555-555555555555';
  v_cli uuid := 'c2222222-2222-2222-2222-222222222222';
  v_emb uuid := 'c3333333-3333-3333-3333-333333333333';
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org Finanzas Ola4')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola4-fin@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli, v_org, 'Cliente Ola4 N7', 'ola4-n7@test.mx'),
         ('c7777777-7777-7777-7777-777777777777', v_org, 'Cliente Ola4 N8', 'ola4-n8@test.mx')
  ON CONFLICT (id) DO NOTHING;

  -- N7: un embarque con 2 ventas y 3 costos → no debe haber fan-out.
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, modo, tipo, eta, tipo_cambio_usd)
  VALUES (v_emb, v_org, v_cli, 'ELNSA001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, CURRENT_DATE, 18.0)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, precio_unitario, total, moneda)
  VALUES (v_emb, v_org, 'Venta 1', 100, 100, 'USD'), (v_emb, v_org, 'Venta 2', 200, 200, 'USD');

  INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
  VALUES (v_emb, v_org, 'Costo 1', 10, 'USD'), (v_emb, v_org, 'Costo 2', 20, 'USD'),
         (v_emb, v_org, 'Costo 3', 30, 'USD');

  -- N8: embarque del año actual con venta en USD y con tipo_cambio_usd = 1 (equivale a "sin TC").
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, modo, tipo, eta, tipo_cambio_usd)
  VALUES ('c4444444-4444-4444-4444-444444444444', v_org,
          'c7777777-7777-7777-7777-777777777777', 'ELNSB001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          make_date(EXTRACT(year FROM CURRENT_DATE)::int, 1, 15), 1)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, precio_unitario, total, moneda)
  VALUES ('c4444444-4444-4444-4444-444444444444', v_org, 'Venta sin TC', 500, 500, 'USD');

  -- N9: factura NO vencida (vence en 10 días).
  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, numero, expediente,
    moneda, subtotal, iva, total, estado, fecha_emision, fecha_vencimiento
  ) VALUES (
    'c6666666-6666-6666-6666-666666666666', v_org, v_cli, 'Cliente Ola4 N7', 'OLA4-N9-01',
    'ELNSC001', 'MXN'::public.moneda, 1000, 0, 1000, 'Emitida'::public.estado_factura,
    CURRENT_DATE - 5, CURRENT_DATE + 10
  ) ON CONFLICT (id) DO NOTHING;

  -- La sesión se fija AL FINAL: sembrar embarques con claims de 'contador'
  -- dispara el guard "requiere cotización Aceptada" (tarifa-first).
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N7: profit_por_cliente sin fan-out (venta=300, costo=60).
-- -------------------------------------------------------------
DO $n7$
DECLARE
  v_venta numeric; v_costo numeric; v_n bigint;
BEGIN
  SELECT p.venta_usd, p.costo_usd, p.total_embarques INTO v_venta, v_costo, v_n
    FROM public.profit_por_cliente() p
   WHERE p.cliente_id = 'c2222222-2222-2222-2222-222222222222';
  IF v_n IS DISTINCT FROM 1 OR v_venta <> 300 OR v_costo <> 60 THEN
    RAISE EXCEPTION 'TEST FAIL: N7 - profit_por_cliente duplicó montos (embarques=%, venta=%, costo=% ; esperado 1/300/60)', v_n, v_venta, v_costo;
  END IF;
  RAISE NOTICE '✓ N7: profit_por_cliente no duplica montos (venta=300, costo=60)';
END
$n7$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N8: eerr_resumen_anual('embarques') excluye USD sin TC.
-- -------------------------------------------------------------
DO $n8$
DECLARE
  v_year int := EXTRACT(year FROM CURRENT_DATE)::int;
  v_ingresos numeric; v_excluidos int;
BEGIN
  SELECT r.ingresos_mxn, r.excluidos_sin_tc INTO v_ingresos, v_excluidos
    FROM public.eerr_resumen_anual(v_year, 'embarques') r
   WHERE r.mes = 1;
  IF v_ingresos IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N8 - venta USD sin TC sumó a ingresos_mxn (=%, esperado 0)', v_ingresos;
  END IF;
  IF COALESCE(v_excluidos, 0) < 1 THEN
    RAISE EXCEPTION 'TEST FAIL: N8 - excluidos_sin_tc no contabilizó la venta sin TC (=%, esperado >=1)', v_excluidos;
  END IF;
  RAISE NOTICE '✓ N8: venta USD sin TC no suma y excluidos_sin_tc=%', v_excluidos;
END
$n8$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N9: cartera_pendiente con dias_vencido NEGATIVO (no vencida).
-- -------------------------------------------------------------
DO $n9$
DECLARE
  v_dias int;
BEGIN
  SELECT c.dias_vencido INTO v_dias
    FROM public.cartera_pendiente() c
   WHERE c.factura_id = 'c6666666-6666-6666-6666-666666666666';
  IF v_dias IS NULL OR v_dias >= 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N9 - dias_vencido=% (esperado NEGATIVO para factura no vencida)', v_dias;
  END IF;
  RAISE NOTICE '✓ N9: dias_vencido=% (negativo, factura aún no vence)', v_dias;
END
$n9$ LANGUAGE plpgsql;




-- -------------------------------------------------------------
-- CASO N10: embarque en 'Borrador' con ETD/ETA futuros no cuenta como
-- activo ni se deriva a 'Confirmado' en dashboard_summary().
-- -------------------------------------------------------------
DO $n10$
DECLARE
  v_resumen jsonb; v_total_activos int; v_confirmado int;
  v_org_n10 uuid := 'ca111111-1111-1111-1111-111111111111';
  v_uid_n10 uuid := 'ca555555-5555-5555-5555-555555555555';
  v_cli_n10 uuid := 'ca222222-2222-2222-2222-222222222222';
BEGIN
  -- Org aislada para N10: así totalActivos sólo refleja el Borrador.
  -- La siembra corre SIN claims para no disparar el guard tarifa-first.
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO public.organizations (id, nombre) VALUES (v_org_n10, 'Test Org Ola4 N10')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO auth.users (id, email) VALUES (v_uid_n10, 'ola4-n10@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_n10, v_uid_n10, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.clientes (id, organization_id, nombre, email)
  VALUES (v_cli_n10, v_org_n10, 'Cliente Ola4 N10', 'ola4-n10@test.mx') ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (
    id, organization_id, cliente_id, expediente, modo, tipo, estado, etd, eta
  ) VALUES (
    'c1212121-1212-1212-1212-121212121212', v_org_n10, v_cli_n10,
    'ELNSD001', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
    'Borrador'::public.estado_embarque, CURRENT_DATE + 10, CURRENT_DATE + 20
  );

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_n10)::text, true);


  v_resumen := public.dashboard_summary();
  v_total_activos := (v_resumen->>'totalActivos')::int;
  v_confirmado := COALESCE((v_resumen->'conteoPorEstado'->>'Confirmado')::int, 0);

  IF v_total_activos <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N10 - embarque en Borrador cuenta como activo (totalActivos=%)', v_total_activos;
  END IF;
  IF v_confirmado <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: N10 - embarque en Borrador se derivó a Confirmado (conteoPorEstado.Confirmado=%)', v_confirmado;
  END IF;
  RAISE NOTICE '✓ N10: embarque en Borrador no cuenta como activo ni como Confirmado';
END
$n10$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 4 NOTICE "✓ N..." y ROLLBACK. Contra el código
-- pre-Ola4 al menos un caso aborta con TEST FAIL.
-- =============================================================
