-- =============================================================
-- yg02_comisiones_auth.sql · Auditoría YAGNI 2026-08-31 · YG-02
--
-- `registrar_pago_liquidacion` y `cancelar_liquidacion_comision` validaban el
-- rol financiero contra `public.user_roles` GLOBAL: bastaba tener 'contador'
-- registrado en cualquier parte para pagar/cancelar liquidaciones de una
-- organización donde la persona sólo era, por ejemplo, vendedora.
--
-- Guard conductual: la autorización se resuelve POR MEMBRESÍA en la
-- organización dueña de la liquidación (`has_any_role_in_org_exact`), y una
-- liquidación de otra organización sigue siendo inaccesible.
--
--   CASO 1: miembro de la org con rol vendedor + rol global 'contador'
--           → pago rechazado (LC_LIQUIDACION_SIN_ROL)
--   CASO 2: mismo usuario → cancelación rechazada (LC_LIQUIDACION_SIN_ROL)
--   CASO 3: miembro de la org con rol contador → pago aceptado
--   CASO 4: liquidación de OTRA org → LC_LIQUIDACION_OTRA_ORG
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/yg02_comisiones_auth.sql
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre) VALUES
  ('a0a0a0a0-0000-4000-8000-000000000a02'::uuid, 'YG02 Org A'),
  ('b0b0b0b0-0000-4000-8000-000000000b02'::uuid, 'YG02 Org B');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('a0a0a0a0-0000-4000-8000-000000000001', 'yg02-vendedor@test.mx'),
      ('a0a0a0a0-0000-4000-8000-000000000002', 'yg02-contador@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

-- Vendedora en la org A… pero con rol financiero GLOBAL (el bug de YG-02).
INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('a0a0a0a0-0000-4000-8000-000000000a02'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000001', 'vendedor'::public.app_role),
  ('a0a0a0a0-0000-4000-8000-000000000a02'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000002', 'contador'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('a0a0a0a0-0000-4000-8000-000000000001', 'contador'::public.app_role),
  ('a0a0a0a0-0000-4000-8000-000000000002', 'contador'::public.app_role)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.liquidaciones_comision
  (id, organization_id, vendedora_id, periodo, total_mxn, estado)
VALUES
  ('a0a0a0a0-0000-4000-8000-000000000010'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000a02'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000001', '2026-08', 1000, 'Generada'),
  ('a0a0a0a0-0000-4000-8000-000000000011'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000a02'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000001', '2026-07', 500, 'Generada'),
  ('b0b0b0b0-0000-4000-8000-000000000010'::uuid,
   'b0b0b0b0-0000-4000-8000-000000000b02'::uuid,
   'a0a0a0a0-0000-4000-8000-000000000001', '2026-08', 700, 'Generada');

-- -------------------------------------------------------------
-- CASO 1: rol global 'contador' + membresía 'vendedor' → sin permiso de pago
-- -------------------------------------------------------------
DO $caso1$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'a0a0a0a0-0000-4000-8000-000000000001')::text, true);
  BEGIN
    PERFORM public.registrar_pago_liquidacion(
      'a0a0a0a0-0000-4000-8000-000000000010'::uuid, CURRENT_DATE, 'Transferencia');
    RAISE EXCEPTION 'CASO1_FALLO: se aceptó el pago con rol financiero sólo global';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_LIQUIDACION_SIN_ROL%' THEN
      RAISE EXCEPTION 'CASO1_FALLO: error inesperado %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ CASO 1: pago rechazado (%).', SQLERRM;
  END;
END
$caso1$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 2: mismo usuario tampoco puede cancelar
-- -------------------------------------------------------------
DO $caso2$
BEGIN
  BEGIN
    PERFORM public.cancelar_liquidacion_comision(
      'a0a0a0a0-0000-4000-8000-000000000010'::uuid, 'Prueba YG-02');
    RAISE EXCEPTION 'CASO2_FALLO: se aceptó la cancelación con rol financiero sólo global';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_LIQUIDACION_SIN_ROL%' THEN
      RAISE EXCEPTION 'CASO2_FALLO: error inesperado %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ CASO 2: cancelación rechazada (%).', SQLERRM;
  END;
END
$caso2$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 3: contador POR MEMBRESÍA en la org dueña → pago aceptado
-- -------------------------------------------------------------
DO $caso3$
DECLARE
  v_estado text;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'a0a0a0a0-0000-4000-8000-000000000002')::text, true);
  PERFORM public.registrar_pago_liquidacion(
    'a0a0a0a0-0000-4000-8000-000000000010'::uuid, CURRENT_DATE, 'Transferencia');
  SELECT estado INTO v_estado FROM public.liquidaciones_comision
   WHERE id = 'a0a0a0a0-0000-4000-8000-000000000010'::uuid;
  IF v_estado <> 'Pagada' THEN
    RAISE EXCEPTION 'CASO3_FALLO: estado esperado Pagada, obtuvo %', v_estado;
  END IF;
  RAISE NOTICE '✓ CASO 3: contador de la org pagó la liquidación';
END
$caso3$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO 4: liquidación de OTRA organización sigue bloqueada
-- -------------------------------------------------------------
DO $caso4$
BEGIN
  BEGIN
    PERFORM public.registrar_pago_liquidacion(
      'b0b0b0b0-0000-4000-8000-000000000010'::uuid, CURRENT_DATE, 'Transferencia');
    RAISE EXCEPTION 'CASO4_FALLO: se aceptó el pago de una liquidación de otra org';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_LIQUIDACION_OTRA_ORG%' THEN
      RAISE EXCEPTION 'CASO4_FALLO: error inesperado %', SQLERRM;
    END IF;
    RAISE NOTICE '✓ CASO 4: pago cross-org rechazado (%).', SQLERRM;
  END;
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$caso4$ LANGUAGE plpgsql;

ROLLBACK;
