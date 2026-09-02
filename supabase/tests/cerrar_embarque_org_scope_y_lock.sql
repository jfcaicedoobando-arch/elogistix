-- =============================================================
-- cerrar_embarque_org_scope_y_lock.sql
--
-- Cubre el fix de 20260911000100_replay_cerrar_reabrir_org_scope_helper_service_role.sql:
--   · CASO 1 (negativo, cross-org): un admin_org de la Org A NO puede cerrar
--     un embarque de la Org B (antes del fix, `has_role` global permitía a
--     cualquier admin de CUALQUIER org forzar el cierre de embarques ajenos).
--   · CASO 2 (positivo, mismo-org): el mismo rol admin_org SÍ puede cerrar un
--     embarque de su propia org (rol validado en `v_emb.organization_id`).
--   · GUARD ESTRUCTURAL: los triggers `bloquear_conceptos_en_embarque_cerrado`
--     y `tg_bloquear_si_embarque_cerrado` deben seguir leyendo el estado del
--     embarque a través de `_assert_embarque_abierto_locked` (candado
--     FOR KEY SHARE), no con una lectura directa sin candado.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cerrar_embarque_org_scope_y_lock.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org_a uuid;
  v_org_b uuid;
  v_uid_a uuid := gen_random_uuid();
  v_cli_a uuid;
  v_cli_b uuid;
  v_emb_a uuid;
  v_emb_b uuid;
  v_estado_b public.estado_embarque;
  v_estado_a public.estado_embarque;
  v_fallo boolean := false;
  v_res jsonb;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CIERRE ORG A', 'TCA000000XX0', 'basico', true)
  RETURNING id INTO v_org_a;
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CIERRE ORG B', 'TCB000000XX0', 'basico', true)
  RETURNING id INTO v_org_b;

  -- v_uid_a: admin_org SOLO de la Org A.
  INSERT INTO auth.users (id, email) VALUES (v_uid_a, 'cierre-org-a@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_a, v_uid_a, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org_a, 'CLIENTE CIERRE A', '', 'cierre-a@test.mx') RETURNING id INTO v_cli_a;
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org_b, 'CLIENTE CIERRE B', '', 'cierre-b@test.mx') RETURNING id INTO v_cli_b;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org_a, v_cli_a, 'ELCOA0001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Entregado'::public.estado_embarque)
  RETURNING id INTO v_emb_a;
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org_b, v_cli_b, 'ELCOB0001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Entregado'::public.estado_embarque)
  RETURNING id INTO v_emb_b;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_a)::text, true);

  -- ── CASO 1 (negativo, cross-org): admin_org de la Org A cierra el
  -- embarque de la Org B. Debe fallar con "No autorizado".
  BEGIN
    PERFORM public.cerrar_embarque(v_emb_b);
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
    IF SQLERRM !~* 'no autorizado' THEN
      RAISE EXCEPTION 'REGRESION cross-org: se esperaba "No autorizado", se obtuvo: %', SQLERRM;
    END IF;
  END;
  IF NOT v_fallo THEN
    RAISE EXCEPTION 'REGRESION P0: admin_org de la Org A pudo cerrar un embarque de la Org B';
  END IF;

  SELECT estado INTO v_estado_b FROM public.embarques WHERE id = v_emb_b;
  IF v_estado_b = 'Cerrado' THEN
    RAISE EXCEPTION 'REGRESION P0: el embarque de la Org B quedó Cerrado tras el intento cross-org';
  END IF;

  -- ── CASO 2 (positivo, mismo-org): el mismo usuario SÍ puede cerrar el
  -- embarque de su propia org (admin_org fuerza el cierre aunque
  -- validar_cierre_embarque no esté satisfecho, semántica ya existente).
  v_res := public.cerrar_embarque(v_emb_a);
  SELECT estado INTO v_estado_a FROM public.embarques WHERE id = v_emb_a;
  IF v_estado_a <> 'Cerrado' THEN
    RAISE EXCEPTION 'FALLO: admin_org de la Org A no pudo cerrar su propio embarque (estado=%)', v_estado_a;
  END IF;
  IF v_res IS NULL OR COALESCE((v_res->>'ok')::boolean, false) IS NOT TRUE
     OR v_res->'snapshot' IS NULL THEN
    RAISE EXCEPTION 'FALLO: cerrar_embarque no devolvió el snapshot esperado para %', v_emb_a;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE 'OK cerrar_embarque_org_scope: cross-org bloqueado, mismo-org permitido.';
END $$;

-- ── GUARD ESTRUCTURAL: los triggers de bloqueo usan el helper con candado ──
DO $$
DECLARE
  d text;
BEGIN
  d := pg_get_functiondef('public.bloquear_conceptos_en_embarque_cerrado()'::regprocedure);
  IF position('_assert_embarque_abierto_locked' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION P1: bloquear_conceptos_en_embarque_cerrado ya no usa _assert_embarque_abierto_locked (lectura sin candado)';
  END IF;

  d := pg_get_functiondef('public.tg_bloquear_si_embarque_cerrado()'::regprocedure);
  IF position('_assert_embarque_abierto_locked' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION P1: tg_bloquear_si_embarque_cerrado ya no usa _assert_embarque_abierto_locked (lectura sin candado)';
  END IF;

  d := pg_get_functiondef('public._assert_embarque_abierto_locked(uuid)'::regprocedure);
  IF position('FOR KEY SHARE' in d) = 0 THEN
    RAISE EXCEPTION 'REGRESION P1: _assert_embarque_abierto_locked ya no toma FOR KEY SHARE';
  END IF;

  RAISE NOTICE 'OK guard estructural: triggers de bloqueo usan _assert_embarque_abierto_locked con FOR KEY SHARE.';
END $$;

ROLLBACK;
