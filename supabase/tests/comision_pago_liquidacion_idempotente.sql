-- =============================================================
-- comision_pago_liquidacion_idempotente.sql · B-3
--
-- `registrar_pago_liquidacion` debe ser idempotente ante reintentos con los
-- MISMOS datos (doble clic, reintento de red): devuelve la liquidación ya
-- pagada en lugar de fallar, sin re-escribir nada ni duplicar la bitácora.
--
-- Casos:
--   1) primer pago -> queda 'Pagada' con la fecha enviada
--   2) reintento idéntico -> devuelve la misma fila, sin nueva bitácora
--   3) reintento con fecha distinta -> LC_LIQUIDACION_YA_PAGADA
--   4) reintento con método distinto -> LC_LIQUIDACION_YA_PAGADA
--   5) liquidación cancelada -> LC_LIQUIDACION_CANCELADA (sin cambios)
--
-- Todo dentro de BEGIN…ROLLBACK.
--   psql "$SUPABASE_DB_URL" -f supabase/tests/comision_pago_liquidacion_idempotente.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('c3c3c3c3-0000-4000-8000-000000000010', 'Test Org B3 Idempotencia');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('c3c3c3c3-0000-4000-8000-000000000091', 'b3-contador@test.mx'),
      ('c3c3c3c3-0000-4000-8000-000000000092', 'b3-vendedor@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('c3c3c3c3-0000-4000-8000-000000000010', 'c3c3c3c3-0000-4000-8000-000000000091', 'contador'::public.app_role),
  ('c3c3c3c3-0000-4000-8000-000000000010', 'c3c3c3c3-0000-4000-8000-000000000092', 'vendedor'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.liquidaciones_comision (id, organization_id, vendedora_id, periodo, total_mxn, estado)
VALUES ('c3c3c3c3-0000-4000-8000-000000000030', 'c3c3c3c3-0000-4000-8000-000000000010',
        'c3c3c3c3-0000-4000-8000-000000000092', '2026-09', 1500, 'Generada'),
       ('c3c3c3c3-0000-4000-8000-000000000031', 'c3c3c3c3-0000-4000-8000-000000000010',
        'c3c3c3c3-0000-4000-8000-000000000092', '2026-08', 900, 'Cancelada');

DO $b3$
DECLARE
  v_liq uuid := 'c3c3c3c3-0000-4000-8000-000000000030';
  v_liq_cancelada uuid := 'c3c3c3c3-0000-4000-8000-000000000031';
  v_fecha date := CURRENT_DATE;
  v_row public.liquidaciones_comision;
  v_updated timestamptz;
  v_bitacora_1 integer;
  v_bitacora_2 integer;
  v_msg text;
  v_bloqueado boolean;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'c3c3c3c3-0000-4000-8000-000000000091')::text, true);

  -- ── Caso 1: primer pago ─────────────────────────────────────────────────
  v_row := public.registrar_pago_liquidacion(v_liq, v_fecha, 'Transferencia', 'REF-B3-001');
  IF v_row.estado <> 'Pagada' OR v_row.fecha_pago <> v_fecha THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el pago no quedó registrado (estado %, fecha %)',
      v_row.estado, v_row.fecha_pago;
  END IF;
  v_updated := v_row.updated_at;

  SELECT count(*) INTO v_bitacora_1
    FROM public.bitacora_actividad
   WHERE entidad_id = v_liq AND accion = 'registrar_pago_liquidacion';

  -- ── Caso 2: reintento idéntico -> misma fila, sin bitácora nueva ─────────
  v_row := public.registrar_pago_liquidacion(v_liq, v_fecha, 'Transferencia', 'REF-B3-001');
  IF v_row.id <> v_liq OR v_row.estado <> 'Pagada' OR v_row.fecha_pago <> v_fecha THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el reintento idéntico no devolvió la liquidación pagada';
  END IF;
  IF v_row.updated_at <> v_updated THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el reintento idéntico re-escribió la liquidación';
  END IF;

  SELECT count(*) INTO v_bitacora_2
    FROM public.bitacora_actividad
   WHERE entidad_id = v_liq AND accion = 'registrar_pago_liquidacion';
  IF v_bitacora_2 <> v_bitacora_1 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el reintento idéntico duplicó la bitácora (% -> %)',
      v_bitacora_1, v_bitacora_2;
  END IF;
  RAISE NOTICE 'CASO 1-2 OK: reintento idéntico devuelve la liquidación pagada sin efectos';

  -- ── Caso 3: reintento con fecha distinta -> sigue fallando ──────────────
  v_bloqueado := false;
  BEGIN
    PERFORM public.registrar_pago_liquidacion(v_liq, v_fecha - 1, 'Transferencia', 'REF-B3-001');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_YA_PAGADA%' THEN RAISE; END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: un pago con fecha distinta no fue rechazado';
  END IF;

  -- ── Caso 4: reintento con método distinto -> sigue fallando ─────────────
  v_bloqueado := false;
  BEGIN
    PERFORM public.registrar_pago_liquidacion(v_liq, v_fecha, 'Cheque', 'REF-B3-001');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_YA_PAGADA%' THEN RAISE; END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: un pago con método distinto no fue rechazado';
  END IF;
  RAISE NOTICE 'CASO 3-4 OK: datos distintos siguen rechazados';

  -- ── Caso 5: liquidación cancelada ──────────────────────────────────────
  v_bloqueado := false;
  BEGIN
    PERFORM public.registrar_pago_liquidacion(v_liq_cancelada, v_fecha, 'Transferencia');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_CANCELADA%' THEN RAISE; END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'CASO 5 FALLÓ: se pagó una liquidación cancelada';
  END IF;
  RAISE NOTICE 'CASO 5 OK: la liquidación cancelada sigue sin poder pagarse';
END;
$b3$;

ROLLBACK;
