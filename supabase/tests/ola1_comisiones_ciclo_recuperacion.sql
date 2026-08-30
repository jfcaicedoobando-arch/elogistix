-- =============================================================
-- ola1_comisiones_ciclo_recuperacion.sql · OLA 1 · hallazgo A-2
--
-- `cancelar_liquidacion_comision` devolvía TODAS las comisiones ligadas a la
-- liquidación a 'Devengada', incluidas las 'Cancelada' que en realidad eran
-- RECUPERACIONES descontadas por `generar_liquidacion_comision`. Resultado:
-- una deuda de la vendedora se volvía comisión pagable otra vez (doble pago).
--
-- Test COMPORTAMENTAL del ciclo generar → recuperar → cancelar:
--   · comisión ordinaria  : Devengada → Liquidada → Devengada
--   · recuperación aplicada: Por recuperar → Cancelada → Por recuperar
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola1_comisiones_ciclo_recuperacion.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('c1c1c1c1-0000-4000-8000-000000000010', 'Test Ola1 Ciclo Comisiones');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('c1c1c1c1-0000-4000-8000-000000000099', 'ola1-ciclo@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('c1c1c1c1-0000-4000-8000-000000000010', 'c1c1c1c1-0000-4000-8000-000000000099',
        'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

-- `cancelar_liquidacion_comision` valida el rol contra user_roles.
INSERT INTO public.user_roles (user_id, role)
VALUES ('c1c1c1c1-0000-4000-8000-000000000099', 'contador'::public.app_role)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('c1c1c1c1-0000-4000-8000-000000000011', 'c1c1c1c1-0000-4000-8000-000000000010',
        'Cliente Ola1 Ciclo', 'ola1-ciclo-cliente@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('c1c1c1c1-0000-4000-8000-000000000020', 'c1c1c1c1-0000-4000-8000-000000000010',
        'c1c1c1c1-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'c1c1c1c1-0000-4000-8000-000000000012', 20);

INSERT INTO public.vendedora_config (organization_id, user_id, porcentaje_default, activa)
VALUES ('c1c1c1c1-0000-4000-8000-000000000010', 'c1c1c1c1-0000-4000-8000-000000000012', 10, true);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('c1c1c1c1-0000-4000-8000-000000000020', 'c1c1c1c1-0000-4000-8000-000000000010',
        'Flete', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('c1c1c1c1-0000-4000-8000-000000000020', 'c1c1c1c1-0000-4000-8000-000000000010',
        'Maniobras', 600, 'MXN');

INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id,
                             subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('c1c1c1c1-0000-4000-8000-000000000030', 'c1c1c1c1-0000-4000-8000-000000000010', 'OLA1-F1',
        'c1c1c1c1-0000-4000-8000-000000000011', 'c1c1c1c1-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

-- Dos pagos ⇒ dos comisiones devengadas de 20.00 c/u (10% de 400 de utilidad
-- prorrateada por cobro).
INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('c1c1c1c1-0000-4000-8000-000000000031', 'c1c1c1c1-0000-4000-8000-000000000030',
        'c1c1c1c1-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500),
       ('c1c1c1c1-0000-4000-8000-000000000032', 'c1c1c1c1-0000-4000-8000-000000000030',
        'c1c1c1c1-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500);

-- Comisión ORDINARIA del periodo 2026-08.
UPDATE public.comisiones_devengadas
   SET created_at = '2026-08-15 10:00:00-06'::timestamptz
 WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000031';

-- Comisión ya pagada cuyo respaldo se canceló después ⇒ deuda 'Por recuperar'.
UPDATE public.comisiones_devengadas
   SET estado = 'Por recuperar'::public.estado_comision,
       created_at = '2026-07-10 10:00:00-06'::timestamptz
 WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000032';

DO $ciclo$
DECLARE
  v_liq uuid;
  v_total numeric;
  v_ordinaria text;
  v_recuperacion text;
  v_liq_ord uuid;
  v_liq_rec uuid;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'c1c1c1c1-0000-4000-8000-000000000099')::text, true);

  -- ── PASO 1: generar (descuenta la recuperación) ──────────────────────────
  v_liq := public.generar_liquidacion_comision(
    'c1c1c1c1-0000-4000-8000-000000000012', '2026-08',
    'c1c1c1c1-0000-4000-8000-000000000010');

  SELECT total_mxn INTO v_total FROM public.liquidaciones_comision WHERE id = v_liq;
  IF v_total <> 0.00 THEN
    RAISE EXCEPTION 'SETUP FALLÓ: se esperaba una liquidación en 0.00 (20 devengado − 20 recuperado), llegó %', v_total;
  END IF;

  SELECT estado::text INTO v_ordinaria FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000031';
  SELECT estado::text INTO v_recuperacion FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000032';
  IF v_ordinaria <> 'Liquidada' OR v_recuperacion <> 'Cancelada' THEN
    RAISE EXCEPTION 'SETUP FALLÓ: tras generar se esperaba Liquidada/Cancelada, llegó %/%',
      v_ordinaria, v_recuperacion;
  END IF;

  -- ── PASO 2: cancelar la liquidación ─────────────────────────────────────
  PERFORM public.cancelar_liquidacion_comision(v_liq, 'Prueba OLA 1 · ciclo de recuperación');

  SELECT estado::text, liquidacion_id INTO v_ordinaria, v_liq_ord
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000031';
  SELECT estado::text, liquidacion_id INTO v_recuperacion, v_liq_rec
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'c1c1c1c1-0000-4000-8000-000000000032';

  IF v_ordinaria <> 'Devengada' THEN
    RAISE EXCEPTION 'A-2 FALLÓ: la comisión ordinaria debe volver a Devengada (estado=%)', v_ordinaria;
  END IF;
  IF v_recuperacion <> 'Por recuperar' THEN
    RAISE EXCEPTION 'A-2 REGRESIÓN: la recuperación aplicada debe volver a "Por recuperar", no a % (riesgo de doble pago)',
      v_recuperacion;
  END IF;
  IF v_liq_ord IS NOT NULL OR v_liq_rec IS NOT NULL THEN
    RAISE EXCEPTION 'A-2 FALLÓ: las comisiones siguen ligadas a la liquidación cancelada (%, %)',
      v_liq_ord, v_liq_rec;
  END IF;

  RAISE NOTICE 'OLA 1 A-2 OK · ciclo generar→recuperar→cancelar deja Devengada / Por recuperar.';
END
$ciclo$ LANGUAGE plpgsql;

ROLLBACK;
