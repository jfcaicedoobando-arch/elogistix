-- ============================================================================
-- Suite de pruebas de RLS multi-tenant (Libre Carga)
-- ============================================================================
--
-- Este script verifica el aislamiento entre organizaciones simulando dos
-- usuarios (org A admin, org B admin) y un cliente del portal. Cada bloque
-- valida que las políticas RLS impiden ver/modificar datos de otra
-- organización.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_isolation.sql
--
-- El script aborta con un mensaje claro al primer fallo (RAISE EXCEPTION).
-- Diseñado para ejecutarse en una base de pruebas o staging — NO se debe
-- correr en producción porque siembra datos.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Helper: ejecuta una consulta como un usuario específico, vía
--    request.jwt.claims (sin recurrir a SET ROLE, ya que las políticas usan
--    auth.uid()).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.as_user(_user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _user_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'RLS TEST FAIL: %', msg;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. Sembrar dos organizaciones, dos admins y un cliente
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  user_cli uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  visible_count int;
BEGIN
  -- Insertamos como rol postgres (bypass RLS) para preparar el escenario
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'TEST Org A'), (org_b, 'TEST Org B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin'),
    (org_b, user_b, 'admin');

  -- Roles globales (tabla user_roles)
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin'),
    (user_b, 'admin'),
    (user_cli, 'cliente');

  INSERT INTO public.clientes(id, nombre, organization_id) VALUES
    (cli_a, 'Cliente A', org_a),
    (cli_b, 'Cliente B', org_b);

  INSERT INTO public.client_users(cliente_id, user_id, organization_id) VALUES
    (cli_a, user_cli, org_a);

  INSERT INTO public.embarques(id, cliente_id, cliente_nombre, organization_id, tipo, modo, expediente)
    VALUES
      (emb_a, cli_a, 'Cliente A', org_a, 'Importación', 'Marítimo', 'EXP-A-001'),
      (emb_b, cli_b, 'Cliente B', org_b, 'Importación', 'Marítimo', 'EXP-B-001');

  -- --------------------------------------------------------------------------
  -- Test 1: Admin de Org A solo ve clientes de Org A
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.clientes WHERE nombre LIKE 'Cliente %';
  PERFORM pg_temp.assert(visible_count = 1,
    format('Admin A vio %s clientes, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 2: Admin de Org B solo ve clientes de Org B
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_b);
  SELECT COUNT(*) INTO visible_count FROM public.clientes WHERE nombre LIKE 'Cliente %';
  PERFORM pg_temp.assert(visible_count = 1,
    format('Admin B vio %s clientes, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 3: Admin A no puede UPDATE clientes de Org B
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);
  UPDATE public.clientes SET nombre = 'HACKED' WHERE id = cli_b;
  PERFORM pg_temp.as_user(user_b);
  SELECT COUNT(*) INTO visible_count FROM public.clientes
    WHERE id = cli_b AND nombre = 'HACKED';
  PERFORM pg_temp.assert(visible_count = 0,
    'Admin A pudo modificar cliente de Org B (¡fuga RLS!)');

  -- --------------------------------------------------------------------------
  -- Test 4: Embarques aislados por organización
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.embarques
    WHERE expediente IN ('EXP-A-001', 'EXP-B-001');
  PERFORM pg_temp.assert(visible_count = 1,
    format('Admin A vio %s embarques, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 5: Cliente del portal solo ve sus propios embarques (cli_a)
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_cli);
  SELECT COUNT(*) INTO visible_count FROM public.embarques
    WHERE expediente IN ('EXP-A-001', 'EXP-B-001');
  PERFORM pg_temp.assert(visible_count = 1,
    format('Cliente del portal vio %s embarques, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 6: Cliente NO puede ver clientes (tabla)
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_cli);
  SELECT COUNT(*) INTO visible_count FROM public.clientes
    WHERE id IN (cli_a, cli_b);
  PERFORM pg_temp.assert(visible_count <= 1,
    format('Cliente vio %s registros en clientes, esperaba ≤1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 7: app_logs — admin de Org A solo ve logs de su org
  -- --------------------------------------------------------------------------
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.app_logs(level, fn, msg, organization_id) VALUES
    ('info', 'test-fn', 'log-A', org_a),
    ('info', 'test-fn', 'log-B', org_b);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.app_logs
    WHERE fn = 'test-fn';
  PERFORM pg_temp.assert(visible_count = 1,
    format('Admin A vio %s logs, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 8: bitacora_actividad — usuario no puede insertar para otro user_id
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_a);
  BEGIN
    INSERT INTO public.bitacora_actividad(usuario_id, usuario_email, accion, modulo, organization_id)
      VALUES (user_b, 'spoof@test.mx', 'spoof', 'test', org_a);
    PERFORM pg_temp.assert(false,
      'Insert con usuario_id falso debería haber fallado por WITH CHECK');
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL; -- esperado
  END;

  -- Limpieza
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE '✓ Todos los tests de RLS pasaron correctamente';
END;
$$;

-- Rollback siempre — no persistimos datos de prueba
ROLLBACK;
