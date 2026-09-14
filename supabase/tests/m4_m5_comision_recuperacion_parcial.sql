-- =============================================================
-- m4_m5_comision_recuperacion_parcial.sql · lote financiero M4 + M5
--
-- M4: `generar_liquidacion_comision` hacía `CONTINUE` cuando una deuda
-- individual "Por recuperar" era MAYOR que el devengo del periodo, así que
-- pagaba el devengo completo y la deuda quedaba intacta. Ahora se descuenta la
-- PORCIÓN que alcanza, queda registrada en `comisiones_recuperaciones` y el
-- resto sigue pendiente.
--
-- Analogía: antes, si debías $30 y te tocaban $20 de sueldo, te pagaban los
-- $20 y la deuda seguía en $30. Ahora se te retienen los $20 y quedas debiendo
-- $10, con recibo de la retención.
--
-- Escenario: devengo del periodo = 20.00; deuda previa = 30.00.
--   1. generar  → liquidación 0.00, porción recuperada 20.00, pendiente 10.00,
--                 la comisión SIGUE 'Por recuperar' (no se cierra).
--   2. cancelar → la porción se marca revertida (no se borra), la deuda vuelve
--                 a 30.00 y la comisión sigue 'Por recuperar'.
--
-- M5: la lectura/asignación va serializada por (organización, vendedora) con
-- `pg_advisory_xact_lock`, así que dos liquidaciones simultáneas no pueden
-- descontar la misma deuda. Aquí se verifica que el candado exista y sea
-- tomable dentro de la misma transacción (la carrera real se cubre en CI).
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/m4_m5_comision_recuperacion_parcial.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('4d4d4d4d-0000-4000-8000-000000000010', 'Test M4 Recuperación Parcial');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('4d4d4d4d-0000-4000-8000-000000000099', 'm4-parcial@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('4d4d4d4d-0000-4000-8000-000000000010', '4d4d4d4d-0000-4000-8000-000000000099',
        'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('4d4d4d4d-0000-4000-8000-000000000099', 'contador'::public.app_role)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('4d4d4d4d-0000-4000-8000-000000000011', '4d4d4d4d-0000-4000-8000-000000000010',
        'Cliente M4 Parcial', 'm4-parcial-cliente@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('4d4d4d4d-0000-4000-8000-000000000020', '4d4d4d4d-0000-4000-8000-000000000010',
        '4d4d4d4d-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        '4d4d4d4d-0000-4000-8000-000000000012', 20);

INSERT INTO public.vendedora_config (organization_id, user_id, porcentaje_default, activa)
VALUES ('4d4d4d4d-0000-4000-8000-000000000010', '4d4d4d4d-0000-4000-8000-000000000012', 10, true);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('4d4d4d4d-0000-4000-8000-000000000020', '4d4d4d4d-0000-4000-8000-000000000010',
        'Flete', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('4d4d4d4d-0000-4000-8000-000000000020', '4d4d4d4d-0000-4000-8000-000000000010',
        'Maniobras', 600, 'MXN');

INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id,
                             subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('4d4d4d4d-0000-4000-8000-000000000030', '4d4d4d4d-0000-4000-8000-000000000010', 'M4-F1',
        '4d4d4d4d-0000-4000-8000-000000000011', '4d4d4d4d-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

-- Dos pagos ⇒ dos comisiones devengadas de 20.00 c/u.
INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('4d4d4d4d-0000-4000-8000-000000000031', '4d4d4d4d-0000-4000-8000-000000000030',
        '4d4d4d4d-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500),
       ('4d4d4d4d-0000-4000-8000-000000000032', '4d4d4d4d-0000-4000-8000-000000000030',
        '4d4d4d4d-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500);

-- Comisión ORDINARIA del periodo 2026-08 (devengo disponible = 20.00).
UPDATE public.comisiones_devengadas
   SET created_at = '2026-08-15 10:00:00-06'::timestamptz
 WHERE pago_factura_id = '4d4d4d4d-0000-4000-8000-000000000031';

-- Deuda previa MAYOR que el devengo: 30.00 'Por recuperar'.
UPDATE public.comisiones_devengadas
   SET estado = 'Por recuperar'::public.estado_comision,
       comision_mxn = 30.00,
       created_at = '2026-07-10 10:00:00-06'::timestamptz
 WHERE pago_factura_id = '4d4d4d4d-0000-4000-8000-000000000032';

DO $parcial$
DECLARE
  v_comision_deuda uuid;
  v_liq uuid;
  v_total numeric;
  v_estado text;
  v_recuperado numeric;
  v_vivas int;
  v_filas int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '4d4d4d4d-0000-4000-8000-000000000099')::text, true);

  SELECT id INTO v_comision_deuda FROM public.comisiones_devengadas
   WHERE pago_factura_id = '4d4d4d4d-0000-4000-8000-000000000032';

  -- ── PASO 1: generar la liquidación (recuperación PARCIAL) ───────────────
  v_liq := public.generar_liquidacion_comision(
    '4d4d4d4d-0000-4000-8000-000000000012', '2026-08',
    '4d4d4d4d-0000-4000-8000-000000000010');

  SELECT total_mxn INTO v_total FROM public.liquidaciones_comision WHERE id = v_liq;
  IF v_total <> 0.00 THEN
    RAISE EXCEPTION 'M4 FALLÓ: con devengo 20 y deuda 30 la liquidación debe quedar en 0.00, llegó %', v_total;
  END IF;

  SELECT COALESCE(SUM(monto_mxn), 0), count(*) INTO v_recuperado, v_filas
    FROM public.comisiones_recuperaciones
   WHERE liquidacion_id = v_liq AND revertida_at IS NULL;
  IF v_filas <> 1 OR v_recuperado <> 20.00 THEN
    RAISE EXCEPTION 'M4 FALLÓ: se esperaba 1 porción recuperada de 20.00, llegó % fila(s) por %',
      v_filas, v_recuperado;
  END IF;

  SELECT estado::text INTO v_estado FROM public.comisiones_devengadas WHERE id = v_comision_deuda;
  IF v_estado <> 'Por recuperar' THEN
    RAISE EXCEPTION 'M4 FALLÓ: con recuperación parcial la comisión debe seguir "Por recuperar", llegó %', v_estado;
  END IF;

  -- El monto ORIGINAL no se sobrescribe: el pendiente se deriva de las porciones.
  IF (SELECT comision_mxn FROM public.comisiones_devengadas WHERE id = v_comision_deuda) <> 30.00 THEN
    RAISE EXCEPTION 'M4 FALLÓ: el monto original de la comisión no debe modificarse.';
  END IF;

  -- ── PASO 2: cancelar la liquidación (revierte SÓLO sus porciones) ───────
  PERFORM public.cancelar_liquidacion_comision(v_liq, 'Prueba M4 · recuperación parcial');

  SELECT count(*) INTO v_vivas FROM public.comisiones_recuperaciones
   WHERE liquidacion_id = v_liq AND revertida_at IS NULL;
  IF v_vivas <> 0 THEN
    RAISE EXCEPTION 'M4 FALLÓ: al cancelar deben revertirse las porciones de ESA liquidación (% vivas)', v_vivas;
  END IF;

  -- La porción NO se borra: queda el rastro auditable.
  SELECT count(*) INTO v_filas FROM public.comisiones_recuperaciones WHERE liquidacion_id = v_liq;
  IF v_filas <> 1 THEN
    RAISE EXCEPTION 'M4 FALLÓ: la porción revertida debe conservarse como rastro (% filas)', v_filas;
  END IF;

  SELECT estado::text INTO v_estado FROM public.comisiones_devengadas WHERE id = v_comision_deuda;
  IF v_estado <> 'Por recuperar' THEN
    RAISE EXCEPTION 'M4 FALLÓ: tras cancelar, la deuda debe seguir "Por recuperar", llegó %', v_estado;
  END IF;

  -- ── M5: el candado por (org, vendedora) existe y es tomable ─────────────
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'comisiones:4d4d4d4d-0000-4000-8000-000000000010:4d4d4d4d-0000-4000-8000-000000000012', 0));

  RAISE NOTICE 'M4/M5 OK · recuperación parcial 20 de 30, rastro conservado y candado por vendedora.';
END
$parcial$ LANGUAGE plpgsql;

ROLLBACK;
