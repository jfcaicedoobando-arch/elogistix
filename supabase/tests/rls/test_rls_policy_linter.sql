-- ============================================================================
-- Suite RLS — Meta-linter de policies (H7)
-- ============================================================================
-- No mueve datos: inspecciona pg_policies + information_schema.columns y
-- exige que TODA tabla `public` con columna `organization_id` tenga policies
-- cuya expresión mencione alguna de:
--   - organization_id
--   - current_user_org_id
--   - has_role (para bypass admin)
--   - client_users / agente_users (portal / agente)
--   - user_id = auth.uid()  (tablas personales tipo idempotency_keys)
--
-- Si aparece una policy `USING (true)` o `WITH CHECK (true)` sin al menos
-- una de esas piezas, fallará el CI. Es la red de seguridad estructural
-- que evita que un futuro `CREATE POLICY p ON t FOR ALL USING (true)` pase
-- desapercibido.
-- ============================================================================

BEGIN;

\ir _ci_exempt_tables.sql

DO $$
DECLARE
  r record;
  violations text := '';
  n int := 0;
  -- Exenciones centralizadas en _ci_exempt_tables.sql
  -- (categoría 'sin-filtro-tenant'): catálogos globales, acceso por token/key
  -- e internas de edge functions.
  exempt text[] := pg_temp.tablas_exentas('sin-filtro-tenant');
BEGIN
  FOR r IN
    -- Sólo BASE TABLE. Las VIEW aparecen en information_schema.columns pero
    -- las policies se definen sobre las tablas subyacentes; auditarlas aquí
    -- produce falsos positivos (p.ej. v_*, costeo_tarifas_vigentes_v).
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name   = c.table_name
     WHERE c.table_schema = 'public'
       AND c.column_name  = 'organization_id'
       AND t.table_type   = 'BASE TABLE'
       AND c.table_name NOT LIKE 'pg_%'
       AND c.table_name <> ALL(exempt)
     GROUP BY c.table_name
  LOOP
    -- Debe existir al menos una policy que referencie tenant/rol.
    IF NOT EXISTS (
      SELECT 1
        FROM pg_policies p
       WHERE p.schemaname = 'public'
         AND p.tablename = r.table_name
         AND (
              COALESCE(p.qual, '')       ~* '(organization_id|current_user_org_id|has_role|client_users|agente_users|auth\.uid)'
           OR COALESCE(p.with_check, '') ~* '(organization_id|current_user_org_id|has_role|client_users|agente_users|auth\.uid)'
         )
    ) THEN
      violations := violations || format(E'  · %s → no tiene policy con filtro tenant/rol\n', r.table_name);
      n := n + 1;
    END IF;

    -- Detecta policy PERMISIVA explícitamente permisiva (USING true / WITH CHECK true)
    -- que NO esté acompañada por has_role/service_role. Las RESTRICTIVE con `true`
    -- sólo pueden restringir (no expanden acceso) — típico patrón "soft delete
    -- filter" con qual=(deleted_at IS NULL) y with_check=true.
    FOR r IN
      SELECT p.tablename, p.policyname, p.qual, p.with_check
        FROM pg_policies p
       WHERE p.schemaname = 'public'
         AND p.tablename = r.table_name
         AND p.permissive = 'PERMISSIVE'
         AND (
              btrim(COALESCE(p.qual,''))       = 'true'
           OR btrim(COALESCE(p.with_check,'')) = 'true'
         )
         AND 'service_role' <> ALL(p.roles)
    LOOP
      violations := violations || format(E'  · %s → policy %s es USING/WITH CHECK (true) sin restringirse a service_role\n', r.tablename, r.policyname);
      n := n + 1;
    END LOOP;
  END LOOP;


  IF n > 0 THEN
    RAISE EXCEPTION E'RLS LINTER FAIL: % hallazgo(s):\n%', n, violations;
  END IF;

  RAISE NOTICE '✓ test_rls_policy_linter: 0 hallazgos sobre policies de public.*';
END;
$$;

ROLLBACK;
