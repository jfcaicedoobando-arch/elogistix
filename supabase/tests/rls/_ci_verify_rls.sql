-- ============================================================================
-- Verificador de cobertura RLS.
-- Corre después de aplicar todas las migraciones. Falla CI si encuentra:
--
--   1. Tablas en `public` con RLS habilitado pero CERO policies.
--      → la tabla no es legible para nadie excepto bypass roles → los tests
--        de "user_b no debe ver X" pasarían trivialmente con count=0.
--
--   2. Tablas en `public` SIN RLS habilitado (excluyendo whitelist).
--      → la Data API expondría todas las filas.
--
-- Whitelist: tablas que legítimamente no necesitan RLS (configuración global
-- pública, catálogos compartidos, tablas internas no expuestas).
-- ============================================================================

DO $$
DECLARE
  rec record;
  fail_count int := 0;
  missing_policies text := '';
  missing_rls text := '';
  -- Whitelist de tablas que NO requieren RLS (catálogos compartidos / internas)
  whitelist text[] := ARRAY[
    'ratelimit_buckets'            -- bucket de rate limiting interno
    -- O6 (auditoría 2026-07-29, S7-18): eliminadas las 3 entradas
    -- '_backup_*' (tablas dropped en 20260717042435 y 20260717033242).
    -- Política: los backups temporales viven fuera de `public` o con
    -- RLS deny-all; NUNCA se whitelistean aquí.
  ];
BEGIN
  -- 1) Tablas con RLS pero sin policies
  FOR rec IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity = true
       AND NOT EXISTS (
         SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid
       )
       AND c.relname <> ALL(whitelist)
  LOOP
    missing_policies := missing_policies || E'\n  - ' || rec.relname;
    fail_count := fail_count + 1;
  END LOOP;

  -- 2) Tablas sin RLS (excluyendo whitelist)
  FOR rec IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity = false
       AND c.relname <> ALL(whitelist)
  LOOP
    missing_rls := missing_rls || E'\n  - ' || rec.relname;
    fail_count := fail_count + 1;
  END LOOP;

  IF fail_count > 0 THEN
    RAISE EXCEPTION E'RLS COVERAGE FAIL (% problemas):\n\nTablas con RLS pero SIN policies:%\n\nTablas SIN RLS:%\n\nSi alguna es intencional, agregarla al whitelist en _ci_verify_rls.sql',
      fail_count,
      coalesce(nullif(missing_policies, ''), E'\n  (ninguna)'),
      coalesce(nullif(missing_rls, ''), E'\n  (ninguna)');
  END IF;

  RAISE NOTICE '✓ RLS coverage OK — todas las tablas en public tienen RLS + al menos 1 policy';
END $$;
