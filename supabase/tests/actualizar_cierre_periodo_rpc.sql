-- =============================================================
-- actualizar_cierre_periodo_rpc.sql
-- Cubre `public.actualizar_cierre_periodo` (Defecto 4):
--  - avance sin motivo: OK
--  - retroceso/vaciado sin motivo: rechazado
--  - retroceso con motivo (>=10 chars): OK + bitácora
--  - rol no autorizado: rechazado
--  - cross-org: no toca la config de otra organización
-- Todo dentro de BEGIN…ROLLBACK.
-- =============================================================

BEGIN;

INSERT INTO public.organizations (id, nombre) VALUES
  ('acac0000-0000-4000-8000-000000000001'::uuid, 'Cierre RPC Org A'),
  ('bcbc0000-0000-4000-8000-000000000002'::uuid, 'Cierre RPC Org B');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email) VALUES
      ('acac0000-0000-4000-8000-0000000000a1', 'cierre-rpc-contador@test.mx'),
      ('acac0000-0000-4000-8000-0000000000a2', 'cierre-rpc-coord@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role) VALUES
  ('acac0000-0000-4000-8000-000000000001'::uuid,
   'acac0000-0000-4000-8000-0000000000a1', 'contador'::public.app_role),
  ('acac0000-0000-4000-8000-000000000001'::uuid,
   'acac0000-0000-4000-8000-0000000000a2', 'coordinador_logistico'::public.app_role)
ON CONFLICT DO NOTHING;

-- ── Avance sin motivo ⇒ OK ───────────────────────────────────────────────
DO $avance$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'acac0000-0000-4000-8000-0000000000a1')::text, true);

  PERFORM public.actualizar_cierre_periodo(
    'acac0000-0000-4000-8000-000000000001'::uuid, '2026-01-31'::date, NULL);

  IF public.cierre_periodo_fecha('acac0000-0000-4000-8000-000000000001'::uuid) <> '2026-01-31'::date THEN
    RAISE EXCEPTION 'FALLO: el avance sin motivo no quedó guardado';
  END IF;
  RAISE NOTICE '✓ avance de cierre sin motivo: OK';
END
$avance$ LANGUAGE plpgsql;

-- ── Retroceso sin motivo ⇒ rechazado, sin cambios ────────────────────────
DO $retroceso_sin_motivo$
BEGIN
  BEGIN
    PERFORM public.actualizar_cierre_periodo(
      'acac0000-0000-4000-8000-000000000001'::uuid, '2026-01-01'::date, NULL);
    RAISE EXCEPTION 'FALLO: retroceso sin motivo se aceptó';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_CIERRE_MOTIVO_REQUERIDO%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;

  BEGIN
    PERFORM public.actualizar_cierre_periodo(
      'acac0000-0000-4000-8000-000000000001'::uuid, NULL, 'corto');
    RAISE EXCEPTION 'FALLO: vaciado con motivo <10 caracteres se aceptó';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_CIERRE_MOTIVO_REQUERIDO%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;

  IF public.cierre_periodo_fecha('acac0000-0000-4000-8000-000000000001'::uuid) <> '2026-01-31'::date THEN
    RAISE EXCEPTION 'FALLO: el retroceso rechazado sí modificó el cierre';
  END IF;
  RAISE NOTICE '✓ retroceso/vaciado sin motivo suficiente: rechazado';
END
$retroceso_sin_motivo$ LANGUAGE plpgsql;

-- ── Retroceso con motivo válido ⇒ OK + bitácora ──────────────────────────
DO $retroceso_con_motivo$
DECLARE n int;
BEGIN
  PERFORM public.actualizar_cierre_periodo(
    'acac0000-0000-4000-8000-000000000001'::uuid, '2026-01-01'::date,
    'Se detectó una factura mal capturada y hay que corregirla');

  IF public.cierre_periodo_fecha('acac0000-0000-4000-8000-000000000001'::uuid) <> '2026-01-01'::date THEN
    RAISE EXCEPTION 'FALLO: el retroceso con motivo no quedó guardado';
  END IF;

  SELECT count(*) INTO n FROM public.bitacora_actividad
   WHERE modulo = 'configuracion' AND accion = 'actualizar_cierre_periodo'
     AND organization_id = 'acac0000-0000-4000-8000-000000000001'::uuid;
  IF n = 0 THEN
    RAISE EXCEPTION 'FALLO: no quedó bitácora del cambio de cierre';
  END IF;
  RAISE NOTICE '✓ retroceso con motivo válido: OK + bitácora (% filas)', n;
END
$retroceso_con_motivo$ LANGUAGE plpgsql;

-- ── Rol no autorizado (coordinador_logistico) ⇒ rechazado ─────────────────────────────
DO $rol_insuficiente$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'acac0000-0000-4000-8000-0000000000a2')::text, true);
  BEGIN
    PERFORM public.actualizar_cierre_periodo(
      'acac0000-0000-4000-8000-000000000001'::uuid, '2026-02-28'::date, NULL);
    RAISE EXCEPTION 'FALLO: un coordinador_logistico pudo cambiar el cierre de periodo';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_ROL_INSUFICIENTE%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE '✓ rol sin permisos financieros (coordinador_logistico): rechazado';
END
$rol_insuficiente$ LANGUAGE plpgsql;

-- ── Cross-org: el contador de A no puede tocar el cierre de B ────────────
DO $cross_org$
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', 'acac0000-0000-4000-8000-0000000000a1')::text, true);
  BEGIN
    PERFORM public.actualizar_cierre_periodo(
      'bcbc0000-0000-4000-8000-000000000002'::uuid, '2026-01-31'::date, NULL);
    RAISE EXCEPTION 'FALLO: se cambió el cierre de una organización ajena';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE 'LC_ROL_INSUFICIENTE%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado %', SQLERRM;
    END IF;
  END;

  IF public.cierre_periodo_fecha('bcbc0000-0000-4000-8000-000000000002'::uuid) IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO: la org B quedó con un cierre que no le corresponde';
  END IF;
  RAISE NOTICE '✓ cross-org: sin membresía en B, rechazado';
  PERFORM set_config('request.jwt.claims', NULL, true);
END
$cross_org$ LANGUAGE plpgsql;

ROLLBACK;
