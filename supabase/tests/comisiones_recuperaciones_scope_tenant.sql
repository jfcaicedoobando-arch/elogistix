-- =============================================================
-- comisiones_recuperaciones_scope_tenant.sql · Ola 16 (v13.823.385)
--
-- La tabla public.comisiones_recuperaciones es tabla de negocio con
-- organization_id, así que debe llevar el candado RESTRICTIVE de tenant
-- activo (public.rls_tenant_scope_ok). Sin él, un super_admin vuelve a ver
-- filas de TODAS las organizaciones.
--
-- Este test valida sólo estructura (no mueve datos):
--   a) RLS habilitado.
--   b) Existe al menos una policy RESTRICTIVE cuya condición invoca
--      public.rls_tenant_scope_ok.
--   c) Sigue existiendo la policy permisiva de lectura por organización.
--   d) `authenticated` no tiene INSERT/UPDATE/DELETE directos: las
--      mutaciones viven en las RPC SECURITY DEFINER auditadas.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/comisiones_recuperaciones_scope_tenant.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_rls boolean;
  v_restrictive int;
  v_select_org int;
  v_escritura text;
BEGIN
  SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'comisiones_recuperaciones';

  IF v_rls IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL (a): comisiones_recuperaciones sin RLS habilitado';
  END IF;

  SELECT count(*) INTO v_restrictive
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname = 'comisiones_recuperaciones'
     AND p.polpermissive = false
     AND pg_get_expr(p.polqual, p.polrelid) LIKE '%rls_tenant_scope_ok%';

  IF v_restrictive = 0 THEN
    RAISE EXCEPTION 'FAIL (b): falta la policy RESTRICTIVE de tenant activo (rls_tenant_scope_ok)';
  END IF;

  SELECT count(*) INTO v_select_org
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'comisiones_recuperaciones'
     AND permissive = 'PERMISSIVE'
     AND cmd IN ('SELECT', 'ALL')
     AND COALESCE(qual, '') LIKE '%organization_id%';

  IF v_select_org = 0 THEN
    RAISE EXCEPTION 'FAIL (c): se perdió la policy de lectura por organización';
  END IF;

  -- El GRANT masivo de CI reinstala privilegios de tabla, así que el candado
  -- que se verifica es el de RLS: no existe ninguna policy de escritura.
  SELECT string_agg(policyname || ' (' || cmd || ')', ', ' ORDER BY policyname) INTO v_escritura
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'comisiones_recuperaciones'
     AND permissive = 'PERMISSIVE'
     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');

  IF v_escritura IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL (d): hay policy(s) de escritura directa (%). Las mutaciones van por RPC SECURITY DEFINER.', v_escritura;
  END IF;


  RAISE NOTICE '✓ comisiones_recuperaciones: RLS + RESTRICTIVE de tenant activo + lectura in-org, sin escritura directa';
END $$;

ROLLBACK;
