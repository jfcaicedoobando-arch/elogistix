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

-- Helpers compartidos: as_user, as_postgres, assert, assert_insert_blocked
\i supabase/tests/rls/_helpers.sql


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
    (org_a, user_a, 'admin_org'),
    (org_b, user_b, 'admin_org');

  -- Roles globales (tabla user_roles)
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'),
    (user_b, 'admin_org'),
    (user_cli, 'cliente');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cliente A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cliente B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.client_users(cliente_id, user_id, organization_id) VALUES
    (cli_a, user_cli, org_a);

  INSERT INTO public.embarques(id, cliente_id, cliente_nombre, organization_id, tipo, modo, expediente)
    VALUES
      (emb_a, cli_a, 'Cliente A', org_a, 'Importación', 'Marítimo', 'ELISO00001'),
      (emb_b, cli_b, 'Cliente B', org_b, 'Importación', 'Marítimo', 'ELISO00002');

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
    WHERE expediente IN ('ELISO00001', 'ELISO00002');
  PERFORM pg_temp.assert(visible_count = 1,
    format('Admin A vio %s embarques, esperaba 1', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 5: Cliente del portal solo ve sus propios embarques (cli_a)
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_user(user_cli);
  SELECT COUNT(*) INTO visible_count FROM public.embarques
    WHERE expediente IN ('ELISO00001', 'ELISO00002');
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
  PERFORM pg_temp.as_postgres();
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

  -- --------------------------------------------------------------------------
  -- Test 8b (13.135.6): bitacora_actividad — SELECT cross-tenant.
  -- Antes sólo se validaba el WITH CHECK del INSERT; una policy de SELECT mal
  -- escrita habría dejado fugar la bitácora de otra org sin detección.
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.bitacora_actividad(usuario_id, usuario_email, accion, modulo, organization_id)
    VALUES (user_b, 'b@test.mx', 'login', 'auth', org_b);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.bitacora_actividad
    WHERE organization_id = org_b;
  PERFORM pg_temp.assert(visible_count = 0,
    format('Admin A vio %s entradas de bitácora de Org B, esperaba 0', visible_count));


  -- --------------------------------------------------------------------------
  -- Test 9 (12.61.11): notificaciones_internas — bug-simulado con organization_id
  -- de otra org NO debe ser visible aunque usuario_id coincida.
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.notificaciones_internas(usuario_id, organization_id, tipo, titulo, mensaje)
    VALUES
      (user_a, org_a, 'info', 'noti-A', 'msg-A'),
      (user_a, org_b, 'info', 'noti-CROSS', 'msg-CROSS'); -- bug: org cruzada

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.notificaciones_internas
    WHERE usuario_id = user_a;
  PERFORM pg_temp.assert(visible_count = 1,
    format('User A vio %s notificaciones internas, esperaba 1 (la cruzada debe bloquearse)', visible_count));

  -- --------------------------------------------------------------------------
  -- Test 10 (12.61.11): crm_notificaciones — mismo refuerzo
  -- --------------------------------------------------------------------------
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.crm_notificaciones(user_id, organization_id, tipo, titulo, mensaje)
    VALUES
      (user_a, org_a, 'info', 'crm-A', 'msg-A'),
      (user_a, org_b, 'info', 'crm-CROSS', 'msg-CROSS');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible_count FROM public.crm_notificaciones
    WHERE user_id = user_a;
  PERFORM pg_temp.assert(visible_count = 1,
    format('User A vio %s crm_notificaciones, esperaba 1 (la cruzada debe bloquearse)', visible_count));

  -- Limpieza
  PERFORM pg_temp.as_postgres();
  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE '✓ Todos los tests de RLS pasaron correctamente';
END;
$$;

-- Rollback siempre — no persistimos datos de prueba
ROLLBACK;
