-- ============================================================================
-- _ci_roles.sql — Roles de Supabase/PostgREST que el CI necesita.
--
-- Postgres vanilla no trae `anon`, `authenticated`, `service_role`, etc., pero
-- las migraciones (GRANT ... TO authenticated) y las policies del snapshot
-- (`TO authenticated`) los dan por hechos: sin ellos `pg_restore` aborta con
-- "role does not exist" y las migraciones fallan al primer GRANT.
--
-- Fuente ÚNICA de verdad. Antes este bloque estaba copiado 5 veces dentro de
-- `.github/workflows/rls-tests.yml` (uno por job que restaura el dump) más una
-- sexta copia en `_ci_bootstrap.sql`: seis lugares que había que editar a mano
-- al agregar un rol. Consumido por:
--   - supabase/tests/rls/_ci_bootstrap.sql (vía \ir, base construida de cero)
--   - .github/workflows/rls-tests.yml (paso "Create Supabase roles", vía -f)
--
-- Idempotente: se puede correr N veces sobre la misma base sin error.
-- ============================================================================

DO $$
DECLARE
  -- Cada elemento es 'rol|atributos'. Agregar un rol aquí lo propaga a todos
  -- los jobs de CI automáticamente.
  v_rol record;
BEGIN
  FOR v_rol IN
    SELECT *
    FROM (
      VALUES
        ('anon',                   'NOLOGIN'),
        ('authenticated',          'NOLOGIN'),
        -- BYPASSRLS: es el rol que usan las edge functions y los seeds del CI.
        ('service_role',           'NOLOGIN BYPASSRLS'),
        ('supabase_admin',         'NOLOGIN'),
        ('supabase_auth_admin',    'NOLOGIN'),
        ('supabase_storage_admin', 'NOLOGIN'),
        ('authenticator',          'NOLOGIN')
    ) AS t(nombre, atributos)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol.nombre) THEN
      EXECUTE format('CREATE ROLE %I %s', v_rol.nombre, v_rol.atributos);
    END IF;
  END LOOP;
END $$;
