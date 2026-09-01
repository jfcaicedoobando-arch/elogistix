-- =============================================================
-- ola4_n41_n44_n45.sql · Ola 4 (medias/bajas) · valuación por moneda
--
-- Cubre:
--   N41: dashboard_summary().arribosEsteMes.gastosOperativosMXN valúa por
--        moneda propia del gasto (MXN directo, USD sólo con TC>1, EUR con
--        tipo_cambio_eur del embarque) y no suma 1:1 ni con TC cruzado.
--   N44: cartera_pendiente() convierte las NCs aplicadas a la moneda de la
--        factura antes de restarlas (no resta 1:1 entre monedas distintas).
--   N45: dashboard_details().mesSiguiente excluye facturas 'Sustituida'
--        (y 'Cancelada'/'Borrador') del flag "facturado".
--
-- Sigue el patrón de ola4_altas.sql: fixture con IDs deterministas +
-- set_config('request.jwt.claims', ...) para simular auth.uid().
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_n41_n44_n45.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org uuid := 'c1111111-1111-1111-1111-111111111111';
  v_uid uuid := 'c5555555-5555-5555-5555-555555555555';
  v_cli uuid := 'c6666666-6666-6666-6666-666666666666';
  v_prov uuid := 'c7777777-7777-7777-7777-777777777777';
  v_cat uuid := 'c8888888-8888-8888-8888-888888888888';
  -- v13.821.3: el tablero razona en hora de México (dashboard_details_datos);
  -- con `current_date` (UTC) el fixture caía en otro mes entre 18:00 y 24:00
  -- CDMX y el embarque del "mes siguiente" quedaba fuera del rango.
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org Ola4 N41N44N45')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola4-n41@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin_org')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cli, v_org, 'Cliente Ola4 N41', 'XAXX010101000', 'ola4-n41@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
  VALUES (v_prov, v_org, 'Prov Ola4 N41', 'GastoOperativo', 'Otros')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat Ola4 N41 Admin', 0, true, 'Administracion')
  ON CONFLICT (id) DO NOTHING;

  -- ---- N41: 3 facturas de gasto (mes en curso) ----
  -- (a) USD sin TC capturado (tipo_cambio_usd DEFAULT 0) -> no debe sumar.
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, fecha_emision
  ) VALUES (
    'c9999991-1111-1111-1111-111111111111', v_org, v_prov, 'Prov Ola4', 'OLA4-N41-USD-SIN-TC',
    v_cat, 'USD'::public.moneda, 0, 1000, 0, 1000, 'Vigente', v_hoy
  ) ON CONFLICT (id) DO NOTHING;

  -- (b) USD con TC = 17 -> debe aportar 1000*17 = 17,000.
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, fecha_emision
  ) VALUES (
    'c9999992-2222-2222-2222-222222222222', v_org, v_prov, 'Prov Ola4', 'OLA4-N41-USD-CON-TC',
    v_cat, 'USD'::public.moneda, 17, 1000, 0, 1000, 'Vigente', v_hoy
  ) ON CONFLICT (id) DO NOTHING;

  -- (c) EUR sin embarque vinculado (sin tipo_cambio_eur) -> no debe sumar
  -- (antes se valuaba erróneamente con el TC USD del embarque).
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, fecha_emision
  ) VALUES (
    'c9999993-3333-3333-3333-333333333333', v_org, v_prov, 'Prov Ola4', 'OLA4-N41-EUR-SIN-TC',
    v_cat, 'EUR'::public.moneda, 0, 1000, 0, 1000, 'Vigente', v_hoy
  ) ON CONFLICT (id) DO NOTHING;

  -- ---- N44: factura USD 10,000 con NC en MXN 5,000 ----
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo)
  VALUES ('c2222221-1111-1111-1111-111111111111', v_org, 'ELOLA4441', v_cli,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas (
    id, organization_id, numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado
  ) VALUES (
    'c3333331-1111-1111-1111-111111111111', v_org, 'OLA4-N44-01', 'c2222221-1111-1111-1111-111111111111',
    'ELOLA4441', v_cli, 'Cliente Ola4 N41', 10000, 0, 10000, 'USD'::public.moneda, 17,
    v_hoy, v_hoy + interval '15 day', 'Emitida'::public.estado_factura
  ) ON CONFLICT (id) DO NOTHING;

  -- BUG-05: una NC 'Aplicada' exige folio fiscal (UUID) timbrado.
  INSERT INTO public.factura_notas_credito (
    id, organization_id, factura_id, folio, motivo, descripcion, monto, moneda,
    tipo_cambio, estado, fecha_emision, uuid_fiscal
  ) VALUES (
    'c4444441-1111-1111-1111-111111111111', v_org, 'c3333331-1111-1111-1111-111111111111',
    'NC-OLA4-N44-01', 'Otro', 'NC en otra moneda', 5000, 'MXN'::public.moneda, 1,
    'Aplicada', v_hoy, '33333333-3333-3333-3333-333333333333'
  ) ON CONFLICT (id) DO NOTHING;

  -- ---- N45: embarque con ETA el mes siguiente y única factura Sustituida ----
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo, eta)
  VALUES ('c5555551-1111-1111-1111-111111111111', v_org, 'ELOLA4451', v_cli,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          (date_trunc('month', v_hoy) + interval '1 month' + interval '5 day')::date)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas (
    id, organization_id, numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado
  ) VALUES (
    'c6666661-1111-1111-1111-111111111111', v_org, 'OLA4-N45-01', 'c5555551-1111-1111-1111-111111111111',
    'ELOLA4451', v_cli, 'Cliente Ola4 N41', 1000, 0, 1000, 'MXN'::public.moneda, 1,
    v_hoy, v_hoy + interval '15 day', 'Sustituida'::public.estado_factura
  ) ON CONFLICT (id) DO NOTHING;

  -- Segundo embarque del mes siguiente, SIN factura Sustituida (control):
  -- factura vigente 'Emitida' -> debe seguir contando como facturado.
  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo, eta)
  VALUES ('c5555552-2222-2222-2222-222222222222', v_org, 'ELOLA4452', v_cli,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          (date_trunc('month', v_hoy) + interval '1 month' + interval '6 day')::date)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.facturas (
    id, organization_id, numero, embarque_id, expediente, cliente_id, cliente_nombre,
    subtotal, iva, total, moneda, tipo_cambio, fecha_emision, fecha_vencimiento, estado
  ) VALUES (
    'c6666662-2222-2222-2222-222222222222', v_org, 'OLA4-N45-02', 'c5555552-2222-2222-2222-222222222222',
    'ELOLA4452', v_cli, 'Cliente Ola4 N41', 1000, 0, 1000, 'MXN'::public.moneda, 1,
    v_hoy, v_hoy + interval '15 day', 'Emitida'::public.estado_factura
  ) ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N41: gastosOperativosMXN sólo suma la USD con TC>1 (17,000); las
-- USD-sin-TC y EUR-sin-TC quedan excluidas (no aportan 0 silencioso, quedan
-- contadas en gastosOperativosSinTC).
-- -------------------------------------------------------------
DO $n41$
DECLARE
  v_resumen jsonb;
  v_gastos numeric;
  v_sin_tc int;
BEGIN
  v_resumen := public.dashboard_summary();
  v_gastos := (v_resumen #>> '{arribosEsteMes,gastosOperativosMXN}')::numeric;
  v_sin_tc := (v_resumen #>> '{arribosEsteMes,gastosOperativosSinTC}')::int;

  IF v_gastos IS DISTINCT FROM 17000 THEN
    RAISE EXCEPTION 'TEST FAIL: N41 - gastosOperativosMXN esperado 17000, obtenido %', v_gastos;
  END IF;
  IF v_sin_tc < 2 THEN
    RAISE EXCEPTION 'TEST FAIL: N41 - gastosOperativosSinTC esperado >= 2 (USD sin TC + EUR sin TC), obtenido %', v_sin_tc;
  END IF;
  RAISE NOTICE '✓ N41: gastosOperativosMXN=% (sólo USD con TC>1) y gastosOperativosSinTC=% (excluidas contadas)', v_gastos, v_sin_tc;
END
$n41$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N44: NC en MXN sobre factura USD se convierte con el TC de la
-- factura antes de restarse: nc_aplicadas ≈ 5000/17 ≈ 294.12,
-- saldo ≈ 10000 - 294.12 ≈ 9705.88 (antes: saldo 5000 por resta 1:1).
-- -------------------------------------------------------------
DO $n44$
DECLARE
  v_saldo numeric;
BEGIN
  SELECT cp.saldo INTO v_saldo
  FROM public.cartera_pendiente() cp
  WHERE cp.factura_id = 'c3333331-1111-1111-1111-111111111111';

  IF v_saldo IS NULL THEN
    RAISE EXCEPTION 'TEST FAIL: N44 - la factura no aparece en cartera_pendiente (saldo debería ser > 0)';
  END IF;
  IF abs(v_saldo - 9705.88) > 0.5 THEN
    RAISE EXCEPTION 'TEST FAIL: N44 - saldo esperado ~9705.88 (conversión NC MXN/TC 17), obtenido %', v_saldo;
  END IF;
  RAISE NOTICE '✓ N44: saldo con NC convertida a la moneda de la factura = %', v_saldo;
END
$n44$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N45: mesSiguiente excluye facturas Sustituida del flag "facturado".
-- -------------------------------------------------------------
DO $n45$
DECLARE
  v_details jsonb;
  v_embarques jsonb;
  v_facturado_sustituida boolean;
  v_facturado_vigente boolean;
  v_total_facturados int;
BEGIN
  v_details := public.dashboard_details();
  v_embarques := v_details -> 'embarquesMesSiguiente';

  SELECT (e ->> 'facturado')::boolean INTO v_facturado_sustituida
  FROM jsonb_array_elements(v_embarques) e
  WHERE e ->> 'id' = 'c5555551-1111-1111-1111-111111111111';

  SELECT (e ->> 'facturado')::boolean INTO v_facturado_vigente
  FROM jsonb_array_elements(v_embarques) e
  WHERE e ->> 'id' = 'c5555552-2222-2222-2222-222222222222';

  v_total_facturados := (v_details #>> '{resumenMesSiguiente,facturados}')::int;

  IF v_facturado_sustituida IS TRUE THEN
    RAISE EXCEPTION 'TEST FAIL: N45 - embarque con única factura Sustituida sigue marcado facturado=true';
  END IF;
  IF v_facturado_vigente IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'TEST FAIL: N45 - embarque con factura Emitida vigente debería seguir facturado=true, obtenido %', v_facturado_vigente;
  END IF;
  RAISE NOTICE '✓ N45: Sustituida excluida del flag facturado (=%), Emitida vigente conservada (=%), total facturados mes sig=%',
    v_facturado_sustituida, v_facturado_vigente, v_total_facturados;
END
$n45$ LANGUAGE plpgsql;

ROLLBACK;

-- =============================================================
-- Resultado esperado: 3 NOTICE "✓ N41/N44/N45" y ROLLBACK. Contra el código
-- pre-Ola4 (fixes N41/N44/N45 ausentes) el caso correspondiente aborta con
-- TEST FAIL.
-- =============================================================
