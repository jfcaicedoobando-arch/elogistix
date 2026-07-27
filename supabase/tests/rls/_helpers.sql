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
