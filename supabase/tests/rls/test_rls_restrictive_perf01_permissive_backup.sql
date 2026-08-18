-- ============================================================================
-- Suite RLS — Respaldo PERMISSIVE de las RESTRICTIVE de PERF-01 (OLA 8)
-- ============================================================================
-- La migración 20260818055401 (PERF-01) reescribió ~90 policies de tenant a
-- RESTRICTIVE con corto-circuito InitPlan:
--   (NOT has_role('super_admin')) OR rls_tenant_scope_ok(organization_id)
-- delegando el aislamiento real en las policies PERMISSIVE (RLS: sin al menos
-- una PERMISSIVE que habilite la fila, la RESTRICTIVE sólo restringe sobre un
-- conjunto vacío → la tabla queda ilegible para TODOS menos bypass roles).
--
-- Este meta-test verifica que TODA tabla con una policy RESTRICTIVE de ese
-- patrón tenga al menos UNA policy PERMISSIVE que filtre por tenant/rol
-- (misma heurística que test_rls_policy_linter), salvo lista blanca
-- documentada (catálogos globales / tablas sólo service_role / internas).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  r record;
  violations text := '';
  n int := 0;
  v_tablas int := 0;
  -- Lista blanca documentada: tablas donde la RESTRICTIVE de tenant NO
  -- necesita respaldo PERMISSIVE porque el acceso es por otra vía:
  whitelist text[] := ARRAY[
    -- Catálogos globales (mismas exenciones que test_rls_policy_linter)
    'catalogo_claves_sat',       -- catálogo SAT global
    'planes',                    -- catálogo de planes
    'tipos_contenedor',          -- catálogo global
    'navieras',                  -- catálogo global de líneas navieras
    'puertos',                   -- catálogo UN/LOCODE
    'configuracion_global',      -- config app-wide (owner)
    -- Ingest / internas sólo service_role
    'facturapi_webhook_eventos', -- ingest interno FacturAPI (solo service_role)
    'email_send_state',          -- interno edge fn
    'email_unsubscribe_tokens',  -- vía token, no org
    'tracking_links',            -- vía token
    'ratelimit_buckets',         -- vía key
    'suppressed_emails',         -- global email suppression
    'demo_leads',                -- landing público
    'folio_secuencias',          -- app-wide
    'idempotency_keys',          -- por user_id = auth.uid()
    -- Tablas operativas exentas de policy de tenant en PERF-01
    -- (bloque de verificación de 20260818055401): auditoría/infra interna
    'app_logs',                  -- logs internos
    'nav_events',                -- telemetría interna
    'provisioning_log',          -- aprovisionamiento (service_role)
    'role_change_log',           -- auditoría de roles (service_role)
    'super_admin_org_activa',    -- estado de impersonación super_admin
    'organization_members',      -- membresía: scope por user_id, no por org de fila
    'client_users',              -- portal cliente: scope por user_id
    'agente_users'               -- portal agente: scope por user_id
  ];
BEGIN
  FOR r IN
    SELECT DISTINCT p.tablename
      FROM pg_policies p
     WHERE p.schemaname = 'public'
       AND p.permissive = 'RESTRICTIVE'
       AND COALESCE(p.qual, '') LIKE '%rls_tenant_scope_ok%'
       AND COALESCE(p.qual, '') LIKE '%has_role%super_admin%'
       AND p.tablename <> ALL(whitelist)
     ORDER BY p.tablename
  LOOP
    v_tablas := v_tablas + 1;
    IF NOT EXISTS (
      SELECT 1
        FROM pg_policies q
       WHERE q.schemaname = 'public'
         AND q.tablename = r.tablename
         AND q.permissive = 'PERMISSIVE'
         AND (
              COALESCE(q.qual, '')       ~* '(organization_id|current_user_org_id|rls_tenant_scope_ok|has_role|client_users|agente_users|auth\.uid)'
           OR COALESCE(q.with_check, '') ~* '(organization_id|current_user_org_id|rls_tenant_scope_ok|has_role|client_users|agente_users|auth\.uid)'
         )
    ) THEN
      violations := violations || format(
        E'  · %s → tiene RESTRICTIVE PERF-01 pero ninguna PERMISSIVE con filtro tenant/rol (tabla ilegible para authenticated)\n',
        r.tablename);
      n := n + 1;
    END IF;
  END LOOP;

  IF n > 0 THEN
    RAISE EXCEPTION E'RLS PERF-01 BACKUP FAIL: % tabla(s) sin PERMISSIVE de respaldo:\n%\n(si la tabla es catálogo global o sólo service_role, agrégala a la whitelist documentada de este test)', n, violations;
  END IF;

  RAISE NOTICE '✓ test_rls_restrictive_perf01_permissive_backup: % tabla(s) con RESTRICTIVE PERF-01, todas con PERMISSIVE tenant de respaldo', v_tablas;
END;
$$;

ROLLBACK;

