-- ============================================================================
-- Post-migración CI: relaja restricciones que dependen de GoTrue real.
--
-- Las suites RLS generan UUIDs aleatorios para usuarios simulados y los
-- pasan vía request.jwt.claims.sub. No insertan filas reales en auth.users
-- (no hay GoTrue en CI), así que los FK ... REFERENCES auth.users(id)
-- bloquearían los seeds. Soltamos esos FK únicamente en el contenedor CI.
-- ============================================================================

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           c.relname AS table_name,
           con.conname
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'f'
       AND con.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      r.schema_name, r.table_name, r.conname
    );
  END LOOP;
END $$;

-- ============================================================================
-- GRANTs CI-only. En Supabase managed, los roles `authenticated`, `anon` y
-- `service_role` reciben privilegios por default sobre el schema `public` vía
-- la configuración de la plataforma. En CI corremos un Postgres vainilla, así
-- que replicamos esa concesión para que las pruebas RLS puedan ejercitar las
-- policies (de otro modo fallan con "permission denied" antes de evaluar RLS).
-- Esto NO se aplica a producción — vive sólo en este script de CI.
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

