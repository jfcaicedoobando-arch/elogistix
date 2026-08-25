-- ============================================================================
-- Helpers compartidos por las suites RLS.
-- Incluir con: \i supabase/tests/rls/_helpers.sql  (después del BEGIN;)
--
-- Convención:
--   pg_temp.as_user(uuid)   → simula auth.uid() = uuid + role=authenticated
--   pg_temp.as_postgres()   → restaura sesión a postgres (RESET ROLE +
--                              limpia request.jwt.claims). USAR SIEMPRE en
--                              lugar de RESET ROLE pelado, sino el siguiente
--                              INSERT sigue corriendo con el JWT viejo y RLS
--                              activo, lo que provoca falsos verdes.
--   pg_temp.assert(bool,msg)→ aborta con RAISE EXCEPTION si la condición es
--                              falsa. Mensaje aparece en el log de CI.
-- ============================================================================

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

CREATE OR REPLACE FUNCTION pg_temp.as_postgres() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- Limpiar claims primero: RESET ROLE no toca request.jwt.claims y
  -- auth.uid() seguiría devolviendo el sub del usuario simulado anterior.
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM set_config('role', NULL, true);
  RESET ROLE;
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

-- Helper para probar que un INSERT cruzado por org está bloqueado por RLS.
-- Recibe el SQL del INSERT (debe usar organization_id = $1 ajeno a la sesión
-- actual) y verifica que lance:
--   - insufficient_privilege (42501) — RLS clásico
--   - check_violation       (23514) — WITH CHECK failed
--   - raise_exception       (P0001) — trigger `LC_*` de guardia
-- Cualquier OTRO error (NOT NULL, FK, tipo) indica que el fixture es incorrecto
-- y el test se aborta con mensaje explícito, evitando falsos verdes.
CREATE OR REPLACE FUNCTION pg_temp.assert_insert_blocked(_sql text, _msg text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_msg   text;
BEGIN
  BEGIN
    EXECUTE _sql;
    RAISE EXCEPTION 'RLS TEST FAIL: % — INSERT cruzado NO fue bloqueado', _msg;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        v_state = RETURNED_SQLSTATE,
        v_msg   = MESSAGE_TEXT;
      RAISE EXCEPTION 'RLS TEST FIXTURE FAIL: % — INSERT falló por SQLSTATE % (%) — no es un bloqueo de RLS, revisa NOT NULL/FK del fixture', _msg, v_state, v_msg;
  END;
END;
$$;

-- ============================================================================
-- Fixture compartido: dos organizaciones + un admin en cada una.
-- (~30 suites reimplementaban este seed a mano; las nuevas deben usar esto.)
--
-- Uso:
--   SELECT * INTO STRICT v_fx FROM pg_temp.seed_org_pair('SCOPE');
--   -- v_fx.org_a / v_fx.org_b / v_fx.admin_a / v_fx.admin_b
--
-- Siembra `auth.users` en modo best-effort (en CI los FK a auth.users se
-- sueltan y GoTrue no existe). Siempre dentro de un BEGIN…ROLLBACK.
-- ============================================================================
CREATE OR REPLACE FUNCTION pg_temp.seed_org_pair(
  _prefijo text,
  _rol text DEFAULT 'admin_org'
) RETURNS TABLE (org_a uuid, org_b uuid, admin_a uuid, admin_b uuid)
LANGUAGE plpgsql AS $$
DECLARE
  o_a uuid := gen_random_uuid();
  o_b uuid := gen_random_uuid();
  u_a uuid := gen_random_uuid();
  u_b uuid := gen_random_uuid();
BEGIN
  BEGIN
    INSERT INTO auth.users(id, email) VALUES
      (u_a, lower(_prefijo) || '-a@test.local'),
      (u_b, lower(_prefijo) || '-b@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- CI sin GoTrue: los FK contra auth.users ya no existen.
  END;

  INSERT INTO public.organizations(id, nombre) VALUES
    (o_a, _prefijo || ' A'), (o_b, _prefijo || ' B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (o_a, u_a, _rol::text::app_role), (o_b, u_b, _rol::text::app_role);

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_a, _rol::text::app_role), (u_b, _rol::text::app_role)
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  RETURN QUERY SELECT o_a, o_b, u_a, u_b;
END;
$$;
