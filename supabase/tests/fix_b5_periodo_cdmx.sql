-- =============================================================
-- fix_b5_periodo_cdmx.sql · FIX B-5 (periodo de liquidación CDMX)
--
-- `generar_liquidacion_comision` debe evaluar el periodo de la comisión en
-- horario 'America/Mexico_City' (fix original 20260821002602, pisado por
-- 20260825000400_bl05 en replay limpio y re-emitido en
-- 20260827090050_fix_b5_periodo_cdmx_replay.sql).
--
--   · CASO 1 — estático: el cuerpo vigente usa AT TIME ZONE
--              'America/Mexico_City' en las DOS consultas (SUM y UPDATE).
--   · CASO 2 — comportamental: comisión devengada el 31-ago 19:00 CDMX
--              (= 1-sep 01:00 UTC) se liquida en el periodo '2026-08';
--              una devengada el 1-sep 10:00 CDMX NO entra a ese periodo.
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix_b5_periodo_cdmx.sql
-- =============================================================

BEGIN;

-- -------------------------------------------------------------
-- CASO 1: estático — ambas consultas filtran el periodo en CDMX.
-- -------------------------------------------------------------
DO $caso1$
DECLARE
  v_def text;
  v_n int;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'generar_liquidacion_comision'
    AND pg_get_function_identity_arguments(p.oid)
        = 'p_vendedora_id uuid, p_periodo text, p_organization_id uuid, p_request_id uuid';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: no existe generar_liquidacion_comision(uuid,text,uuid,uuid)';
  END IF;

  SELECT count(*) INTO v_n
  FROM regexp_matches(v_def, 'AT TIME ZONE ''America/Mexico_City''', 'g');
  IF v_n < 2 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el periodo no se evalúa en America/Mexico_City en ambas consultas (halladas=%)', v_n;
  END IF;
  RAISE NOTICE 'CASO 1 OK · periodo CDMX presente en SUM y UPDATE.';
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: comportamental — frontera de mes 31-ago 19:00 CDMX.
-- -------------------------------------------------------------
-- Fixture: org, admin, vendedora 10%, embarque (venta 1000 − costos 600),
-- factura y dos pagos (dos comisiones devengadas de 20.00 c/u).
INSERT INTO public.organizations (id, nombre)
VALUES ('bb5b5b5b-0000-4000-8000-000000000010', 'Test B5 Periodo CDMX');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('bb5b5b5b-0000-4000-8000-000000000099', 'b5-admin@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('bb5b5b5b-0000-4000-8000-000000000010', 'bb5b5b5b-0000-4000-8000-000000000099', 'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('bb5b5b5b-0000-4000-8000-000000000011', 'bb5b5b5b-0000-4000-8000-000000000010', 'Cliente B5', 'fix-b5@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo, vendedora_id, tipo_cambio_usd)
VALUES ('bb5b5b5b-0000-4000-8000-000000000020', 'bb5b5b5b-0000-4000-8000-000000000010',
        'bb5b5b5b-0000-4000-8000-000000000011', 'Marítimo', 'Importación',
        'bb5b5b5b-0000-4000-8000-000000000012', 20);

INSERT INTO public.vendedora_config (organization_id, user_id, porcentaje_default, activa)
VALUES ('bb5b5b5b-0000-4000-8000-000000000010', 'bb5b5b5b-0000-4000-8000-000000000012', 10, true);

INSERT INTO public.conceptos_venta (embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
VALUES ('bb5b5b5b-0000-4000-8000-000000000020', 'bb5b5b5b-0000-4000-8000-000000000010', 'Flete', 1, 1000, 1000, 'MXN');

INSERT INTO public.conceptos_costo (embarque_id, organization_id, concepto, monto, moneda)
VALUES ('bb5b5b5b-0000-4000-8000-000000000020', 'bb5b5b5b-0000-4000-8000-000000000010', 'Maniobras', 600, 'MXN');

INSERT INTO public.facturas (id, organization_id, numero, cliente_id, embarque_id, subtotal, iva, total, moneda, tipo_cambio, estado, fecha_emision)
VALUES ('bb5b5b5b-0000-4000-8000-000000000030', 'bb5b5b5b-0000-4000-8000-000000000010', 'B5-F1',
        'bb5b5b5b-0000-4000-8000-000000000011', 'bb5b5b5b-0000-4000-8000-000000000020',
        1000, 0, 1000, 'MXN', 1, 'Emitida', CURRENT_DATE);

INSERT INTO public.pagos_factura (id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura)
VALUES ('bb5b5b5b-0000-4000-8000-000000000031', 'bb5b5b5b-0000-4000-8000-000000000030',
        'bb5b5b5b-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500),
       ('bb5b5b5b-0000-4000-8000-000000000032', 'bb5b5b5b-0000-4000-8000-000000000030',
        'bb5b5b5b-0000-4000-8000-000000000010', CURRENT_DATE, 500, 'MXN', 1, 500);

-- Frontera: 31-ago 19:00 CDMX (ago = CDT, UTC-6) == 1-sep 01:00 UTC.
-- Con el bug (UTC del servidor) caía en '2026-09'; con CDMX es '2026-08'.
UPDATE public.comisiones_devengadas
   SET created_at = '2026-08-31 19:00:00-06'::timestamptz
 WHERE pago_factura_id = 'bb5b5b5b-0000-4000-8000-000000000031';

-- Control: 1-sep 10:00 CDMX (sep = CDT, UTC-6) — pertenece a '2026-09'.
UPDATE public.comisiones_devengadas
   SET created_at = '2026-09-01 10:00:00-06'::timestamptz
 WHERE pago_factura_id = 'bb5b5b5b-0000-4000-8000-000000000032';

DO $caso2$
DECLARE
  v_liq uuid;
  v_periodo text;
  v_total numeric;
  v_estado_ago text;
  v_estado_sep text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'bb5b5b5b-0000-4000-8000-000000000099')::text, true);

  v_liq := public.generar_liquidacion_comision(
    'bb5b5b5b-0000-4000-8000-000000000012', '2026-08',
    'bb5b5b5b-0000-4000-8000-000000000010');

  IF v_liq IS NULL THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: no se generó liquidación para 2026-08';
  END IF;

  SELECT periodo, total_mxn INTO v_periodo, v_total
    FROM public.liquidaciones_comision WHERE id = v_liq;
  IF v_periodo <> '2026-08' OR v_total <> 20.00 THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: liquidación periodo=% total=% (esperado 2026-08 / 20.00)', v_periodo, v_total;
  END IF;

  SELECT estado::text INTO v_estado_ago FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb5b5b5b-0000-4000-8000-000000000031';
  IF v_estado_ago <> 'Liquidada' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la comisión del 31-ago 19:00 CDMX no se liquidó en 2026-08 (estado=%)', v_estado_ago;
  END IF;

  SELECT estado::text INTO v_estado_sep FROM public.comisiones_devengadas
   WHERE pago_factura_id = 'bb5b5b5b-0000-4000-8000-000000000032';
  IF v_estado_sep <> 'Devengada' THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: la comisión del 1-sep 10:00 CDMX NO debió entrar a 2026-08 (estado=%)', v_estado_sep;
  END IF;

  RAISE NOTICE 'CASO 2 OK · 31-ago 19:00 CDMX se liquida en 2026-08; 1-sep queda devengada.';
END
$caso2$ LANGUAGE plpgsql;

ROLLBACK;
