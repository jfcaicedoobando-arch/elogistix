-- =============================================================
-- fix4_signup_bootstrap_lock.sql · FIX4 tanda 4 (P3 carrera signup)
--
-- handle_new_user_signup coronaba super_admin al primer usuario con
-- SELECT count(*) sin bloqueo: dos signups concurrentes del sistema vacío
-- leían 0 a la vez y ambos quedaban super_admin (race reproducida en vivo
-- con dos sesiones). El fix pone pg_advisory_xact_lock con clave estable
-- alrededor del bootstrap.
--
--   CASO 1: el cuerpo de la función contiene el candado (muerde pre-fix).
--   CASO 2: bootstrap funcional — con user_roles vacío el primer signup se
--           corona super_admin y el segundo ya no.
--   CASO 3: signup con company_name sigue creando organización y membresía
--           admin_org (regresión del flujo normal bajo el lock).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix4_signup_bootstrap_lock.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.handle_new_user_signup()'::regprocedure) INTO v_def;
  PERFORM pg_temp.assert(
    position('pg_advisory_xact_lock' in v_def) > 0,
    'CASO 1: handle_new_user_signup no tiene pg_advisory_xact_lock (bootstrap sin serializar)');
  RAISE NOTICE 'CASO 1 OK · bootstrap super_admin serializado con pg_advisory_xact_lock.';
END $$;

DO $$
DECLARE
  v_u1 uuid := 'ff6ff6ff-0000-4000-8000-0000000000a1';
  v_u2 uuid := 'ff6ff6ff-0000-4000-8000-0000000000a2';
  v_u3 uuid := 'ff6ff6ff-0000-4000-8000-0000000000a3';
  v_n int;
  v_org uuid;
  v_miembro text;
BEGIN
  -- Simula el sistema vacío (rollback al final; user_roles no tiene FKs entrantes).
  DELETE FROM public.user_roles;

  -- ----------------------------------------------------------
  -- CASO 2: primer signup se corona; el segundo ya no.
  -- ----------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_u1, 'fix4-u1@test.local', '{}'::jsonb);
  SELECT count(*) INTO v_n FROM public.user_roles
   WHERE user_id = v_u1 AND role = 'super_admin'::public.app_role;
  PERFORM pg_temp.assert(v_n = 1, 'CASO 2: el primer signup del sistema vacío no se coronó super_admin');

  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_u2, 'fix4-u2@test.local', '{}'::jsonb);
  SELECT count(*) INTO v_n FROM public.user_roles
   WHERE role = 'super_admin'::public.app_role;
  PERFORM pg_temp.assert(v_n = 1, 'CASO 2: el segundo signup también quedó super_admin (carrera no cerrada)');
  RAISE NOTICE 'CASO 2 OK · bootstrap corona sólo al primer usuario.';

  -- ----------------------------------------------------------
  -- CASO 3: flujo normal con company_name bajo el lock.
  -- ----------------------------------------------------------
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_u3, 'fix4-u3@test.local', '{"company_name":"Fix4 Org"}'::jsonb);
  SELECT m.organization_id, m.role::text INTO v_org, v_miembro
    FROM public.organization_members m WHERE m.user_id = v_u3;
  PERFORM pg_temp.assert(v_org IS NOT NULL AND v_miembro = 'admin_org',
    'CASO 3: el signup con company_name no creó org/membresía admin_org');
  RAISE NOTICE 'CASO 3 OK · alta de organización y membresía intactas.';

  RAISE NOTICE 'FIX4 SIGNUP OK · 3/3 casos.';
END $$;

ROLLBACK;
