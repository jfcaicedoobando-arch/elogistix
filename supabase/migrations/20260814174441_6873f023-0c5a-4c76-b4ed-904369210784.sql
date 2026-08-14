-- ============================================================================
-- Ola 16 · Separación plano plataforma / plano tenant
-- Elimina la fuga cross-organización del super admin: las políticas de negocio
-- decían "... OR has_role(uid,'super_admin')" sin acotar al tenant activo, así
-- que toda consulta sin filtro explícito de organization_id devolvía filas de
-- TODAS las organizaciones.
--
-- Mecanismo: una política RESTRICTIVE uniforme por tabla de negocio. Se aplica
-- en AND con las políticas permisivas existentes, por lo que:
--   * usuario normal / portal cliente / agente  → sin cambios (helper = true)
--   * super admin                               → sólo el tenant de org_scope()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rls_tenant_scope_ok(_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT public.has_role(auth.uid(), 'super_admin'::app_role))
      THEN _org IS NOT NULL AND _org = (SELECT public.org_scope())
    ELSE true
  END;
$$;

COMMENT ON FUNCTION public.rls_tenant_scope_ok(uuid) IS
  'Ola 16: acota al super admin al tenant activo (org_scope()). Devuelve true para cualquier otro usuario: no altera su visibilidad.';

REVOKE ALL ON FUNCTION public.rls_tenant_scope_ok(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_tenant_scope_ok(uuid) TO authenticated, service_role;

DO $$
DECLARE
  v_tabla   record;
  v_policy  text := 'Scope tenant activo super admin';
  -- Plano PLATAFORMA: telemetría y administración cross-tenant del dueño.
  v_excluidas text[] := ARRAY[
    'app_logs',
    'nav_events',
    'provisioning_log',
    'role_change_log',
    'super_admin_org_activa',
    'organization_members',
    'client_users',
    'agente_users',
    'facturapi_webhook_eventos'
  ];
  v_n int := 0;
BEGIN
  FOR v_tabla IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
                       AND a.attname = 'organization_id'
                       AND a.attnum > 0
                       AND NOT a.attisdropped
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND NOT (c.relname = ANY (v_excluidas))
    ORDER BY c.relname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy, v_tabla.relname);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      || 'USING (public.rls_tenant_scope_ok(organization_id)) '
      || 'WITH CHECK (public.rls_tenant_scope_ok(organization_id))',
      v_policy, v_tabla.relname
    );
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'Ola 16: política RESTRICTIVE aplicada en % tablas de negocio.', v_n;
END $$;
