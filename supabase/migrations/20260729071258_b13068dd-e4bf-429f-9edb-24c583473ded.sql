-- ============================================================
-- FIX M8 (auditoría arquitectura 2026-07-29, S5-08)
-- `seed_demo_organization` deja de ser ejecutable por `authenticated`.
-- Estrategia sin duplicar el cuerpo (evita drift con 20260728062322):
--   1. Renombrar la función vigente a `seed_demo_organization_core()`.
--   2. Crear un wrapper `seed_demo_organization()` con guard interno
--      que exige service_role (edge `demo-access`) o super_admin.
-- ============================================================

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_demo_organization' AND p.pronargs = 0
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'seed_demo_organization_core' AND p.pronargs = 0
  ) THEN
    EXECUTE 'ALTER FUNCTION public.seed_demo_organization() RENAME TO seed_demo_organization_core';
  END IF;
END
$mig$;

REVOKE ALL ON FUNCTION public.seed_demo_organization_core() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_organization_core() FROM anon;
REVOKE ALL ON FUNCTION public.seed_demo_organization_core() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO postgres;

CREATE OR REPLACE FUNCTION public.seed_demo_organization()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- M8: sólo service_role (edge `demo-access`) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.seed_demo_organization_core();
END;
$$;

REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM anon;
REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO postgres;

COMMENT ON FUNCTION public.seed_demo_organization() IS
  'M8: wrapper con guard (service_role o super_admin) sobre seed_demo_organization_core().';