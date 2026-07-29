-- ============================================================================
-- supabase/tests/rls/test_rls_rpc_smoke_roles.sql
-- Suite RLS — humo de RPCs SECURITY DEFINER de dinero COMO ROL DE NEGOCIO.
--
-- Fija regresiones que ninguna suite ejecutaba como rol destino:
--   B-065  get_top_tarifas(p_organization_id := org ajena) fugaba tarifas sin
--          validar membresía (corregido en 20260728235553; aquí se FIJA).
--   B-069  rol agente_carga con acceso a pricing/dinero de org ajena.
--   B-016  duplicar_cotizacion rota en runtime (42703): como rol sin privilegio
--          debe dar bloqueo de negocio, NUNCA 42703/42883.
--   B-001  soft delete como rol SIN membresía sobre org ajena: jamás permitido.
--
-- Complementa (no duplica) test_rls_reg_portales.sql, que ya cubre el
-- happy-path de duplicar_cotizacion y el soft delete como admin.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_rpc_smoke_roles.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a    uuid := gen_random_uuid();
  org_b    uuid := gen_random_uuid();
  admin_a  uuid := gen_random_uuid();
  agente_x uuid := gen_random_uuid();  -- agente_carga SIN membresía en ninguna org
  cli_a    uuid := gen_random_uuid();
  cot_a    uuid := gen_random_uuid();
  v_dup    uuid;
  v_dup_ok boolean := false;
  v_count  int;
  v_del    timestamptz;
BEGIN
  -- ── Seed ────────────────────────────────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'SMK ROL A'), (org_b, 'SMK ROL B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, admin_a, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (admin_a, 'admin_org'), (agente_x, 'agente_carga');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli Smoke Rol', 'XAXX010101000', 'smoke-rol@test.local', org_a);
  INSERT INTO public.cotizaciones(
    id, folio, modo, tipo, cliente_id, cliente_nombre, organization_id
  ) VALUES
    (cot_a, 'COT-SMK-ROL-1', 'Marítimo', 'Importación', cli_a, 'Cli Smoke Rol', org_a);

  -- =========================================================================
  -- TEST 1 (B-016 como rol) · duplicar_cotizacion como agente_carga sin
  --   membresía: bloqueo de negocio, jamás 42703/42883 (función rota).
  -- =========================================================================
  PERFORM pg_temp.as_user(agente_x);
  BEGIN
    SELECT public.duplicar_cotizacion(cot_a) INTO v_dup;
    v_dup_ok := true;  -- llegó al final sin excepción: el control de rol se perdió
  EXCEPTION
    WHEN undefined_column OR undefined_function THEN
      RAISE EXCEPTION 'B-016 REGRESION: duplicar_cotizacion rota en runtime (SQLSTATE 42703/42883)';
    WHEN insufficient_privilege OR raise_exception OR no_data_found THEN
      NULL;  -- bloqueo de negocio correcto
  END;
  PERFORM pg_temp.assert(NOT v_dup_ok,
    'agente_carga pudo duplicar cotización de org ajena (control de rol perdido)');

  -- =========================================================================
  -- TEST 2 (B-065) · get_top_tarifas con org AJENA explícita: admin_a (miembro
  --   solo de org_a) pide tarifas de org_b → membresía obligatoria → 0 filas.
  -- =========================================================================
  PERFORM pg_temp.as_user(admin_a);
  BEGIN
    SELECT count(*) INTO v_count
      FROM public.get_top_tarifas(NULL, NULL, NULL, CURRENT_DATE, org_b);
    PERFORM pg_temp.assert(v_count = 0,
      'B-065 REGRESION: get_top_tarifas(p_organization_id=org ajena) devolvió filas sin membresía');
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      NULL;  -- bloqueo explícito también es correcto
  END;

  -- =========================================================================
  -- TEST 3 (B-069) · agente_carga SIN membresía invoca RPCs de dinero contra
  --   org_a: 0 filas o bloqueo, nunca datos.
  -- =========================================================================
  PERFORM pg_temp.as_user(agente_x);

  -- 3a. cxc_aging_clientes (estado de cuenta de clientes)
  BEGIN
    SELECT count(*) INTO v_count
      FROM public.cxc_aging_clientes(org_a, CURRENT_DATE);
    PERFORM pg_temp.assert(v_count = 0,
      'B-069 REGRESION: agente_carga sin membresía leyó el aging CxC de org ajena');
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      NULL;  -- LC_ORG_FORBIDDEN: bloqueo correcto
  END;

  -- 3b. get_top_tarifas contra org_a (pricing)
  BEGIN
    SELECT count(*) INTO v_count
      FROM public.get_top_tarifas(NULL, NULL, NULL, CURRENT_DATE, org_a);
    PERFORM pg_temp.assert(v_count = 0,
      'B-069 REGRESION: agente_carga sin membresía leyó tarifas de org ajena');
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      NULL;
  END;

  -- =========================================================================
  -- TEST 4 (B-001, cara atacante) · soft delete como rol SIN membresía sobre
  --   org ajena: debe fallar o afectar 0 filas.
  -- =========================================================================
  BEGIN
    UPDATE public.cotizaciones SET deleted_at = now() WHERE id = cot_a;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      NULL;  -- bloqueo correcto
  END;
  PERFORM pg_temp.as_postgres();
  SELECT deleted_at INTO v_del FROM public.cotizaciones WHERE id = cot_a;
  PERFORM pg_temp.assert(v_del IS NULL,
    'B-001 REGRESION: un agente_carga sin membresía pudo soft-borrar cotización de org ajena');

  RAISE NOTICE '✓ rpc_smoke_roles OK — 4 bloques (duplicar por rol, membresía tarifas, dinero ajeno, soft delete cross-tenant)';
END $$;

ROLLBACK;
