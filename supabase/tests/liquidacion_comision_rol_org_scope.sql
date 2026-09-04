-- =============================================================
-- liquidacion_comision_rol_org_scope.sql
--
-- `cancelar_liquidacion_comision` y `registrar_pago_liquidacion` deben validar
-- el rol financiero POR MEMBRESÍA en la organización dueña de la liquidación
-- (patrón has_any_role_in_org_exact), no por rol global en user_roles.
--
-- Casos:
--   1) usuario financiero de OTRA organización  -> bloqueado
--   2) miembro de la MISMA org con rol no financiero -> LC_LIQUIDACION_SIN_ROL
--   3) contador de la MISMA org -> puede pagar
--
-- Todo dentro de BEGIN…ROLLBACK.
--   psql "$SUPABASE_DB_URL" -f supabase/tests/liquidacion_comision_rol_org_scope.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre)
VALUES ('a1a1a1a1-0000-4000-8000-000000000010', 'Test Liq Org A'),
       ('b1b1b1b1-0000-4000-8000-000000000010', 'Test Liq Org B');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('a1a1a1a1-0000-4000-8000-000000000091', 'liq-contador-a@test.mx'),
      ('a1a1a1a1-0000-4000-8000-000000000092', 'liq-vendedor-a@test.mx'),
      ('b1b1b1b1-0000-4000-8000-000000000091', 'liq-contador-b@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('a1a1a1a1-0000-4000-8000-000000000010', 'a1a1a1a1-0000-4000-8000-000000000091', 'contador'::public.app_role),
  ('a1a1a1a1-0000-4000-8000-000000000010', 'a1a1a1a1-0000-4000-8000-000000000092', 'vendedor'::public.app_role),
  ('b1b1b1b1-0000-4000-8000-000000000010', 'b1b1b1b1-0000-4000-8000-000000000091', 'contador'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.liquidaciones_comision (id, organization_id, vendedora_id, periodo, total_mxn, estado)
VALUES ('a1a1a1a1-0000-4000-8000-000000000030', 'a1a1a1a1-0000-4000-8000-000000000010',
        'a1a1a1a1-0000-4000-8000-000000000092', '2026-08', 1000, 'Generada');

DO $guard$
DECLARE
  v_msg text;
  v_bloqueado boolean;
  v_estado text;
  v_fecha date;
BEGIN
  -- ── Caso 1: contador de OTRA organización ───────────────────────────────
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'b1b1b1b1-0000-4000-8000-000000000091')::text, true);
  v_bloqueado := false;
  BEGIN
    PERFORM public.cancelar_liquidacion_comision(
      'a1a1a1a1-0000-4000-8000-000000000030', 'Intento cross-tenant');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_OTRA_ORG%'
       AND v_msg NOT LIKE '%LC_LIQUIDACION_SIN_ROL%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'FAIL: un financiero de otra organización canceló la liquidación';
  END IF;

  v_bloqueado := false;
  BEGIN
    PERFORM public.registrar_pago_liquidacion(
      'a1a1a1a1-0000-4000-8000-000000000030', CURRENT_DATE, 'Transferencia');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_OTRA_ORG%'
       AND v_msg NOT LIKE '%LC_LIQUIDACION_SIN_ROL%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'FAIL: un financiero de otra organización pagó la liquidación';
  END IF;

  -- ── Caso 2: miembro de la misma org sin rol financiero ──────────────────
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'a1a1a1a1-0000-4000-8000-000000000092')::text, true);
  v_bloqueado := false;
  BEGIN
    PERFORM public.registrar_pago_liquidacion(
      'a1a1a1a1-0000-4000-8000-000000000030', CURRENT_DATE, 'Transferencia');
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg NOT LIKE '%LC_LIQUIDACION_SIN_ROL%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'FAIL: un rol no financiero de la misma org pagó la liquidación';
  END IF;

  SELECT estado, fecha_pago INTO v_estado, v_fecha
    FROM public.liquidaciones_comision WHERE id = 'a1a1a1a1-0000-4000-8000-000000000030';
  IF v_estado <> 'Generada' OR v_fecha IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: la liquidación cambió pese a los bloqueos (estado=%, fecha=%)', v_estado, v_fecha;
  END IF;

  -- ── Caso 3: contador de la misma org sí puede pagar ─────────────────────
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'a1a1a1a1-0000-4000-8000-000000000091')::text, true);
  PERFORM public.registrar_pago_liquidacion(
    'a1a1a1a1-0000-4000-8000-000000000030', CURRENT_DATE, 'Transferencia');

  SELECT estado, fecha_pago INTO v_estado, v_fecha
    FROM public.liquidaciones_comision WHERE id = 'a1a1a1a1-0000-4000-8000-000000000030';
  IF v_fecha IS NULL THEN
    RAISE EXCEPTION 'FAIL: el contador de la organización no pudo registrar el pago (estado=%)', v_estado;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'OK: el rol financiero de liquidaciones se valida por membresía de la organización.';
END
$guard$ LANGUAGE plpgsql;

ROLLBACK;
