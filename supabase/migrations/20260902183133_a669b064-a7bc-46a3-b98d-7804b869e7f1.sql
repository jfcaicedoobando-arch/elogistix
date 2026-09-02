-- Ronda YAGNI · linter RPC org-scope
-- `_assert_embarque_abierto_locked` es un helper interno llamado sólo desde
-- funciones SECURITY DEFINER (triggers de cierre), que ejecutan como su dueño.
-- Conceder EXECUTE a `authenticated` lo dejaba como SECURITY DEFINER sin ancla
-- de tenant y rompía el linter RPC org-scope. Guardado con IF EXISTS para ser
-- idempotente/forward-only.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = '_assert_embarque_abierto_locked'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public._assert_embarque_abierto_locked(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public._assert_embarque_abierto_locked(uuid) TO service_role';
  END IF;
END;
$$;