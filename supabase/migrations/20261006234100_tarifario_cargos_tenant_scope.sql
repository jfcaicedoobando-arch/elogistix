-- Finite forward after the immutable Drizzle0010 replay. Keep its source,
-- permissive policies, grants, owners and business data unchanged.
-- Ola16 pattern: normal users retain their policies; super admin is confined
-- to the active tenant. These RESTRICTIVE policies never grant access.
DROP POLICY IF EXISTS costeo_cargos_fob_agente_tenant_restrictive ON public.costeo_cargos_fob_agente;
CREATE POLICY costeo_cargos_fob_agente_tenant_restrictive ON public.costeo_cargos_fob_agente
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id))
  WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id));

DROP POLICY IF EXISTS costeo_cargos_locales_naviera_tenant_restrictive ON public.costeo_cargos_locales_naviera;
CREATE POLICY costeo_cargos_locales_naviera_tenant_restrictive ON public.costeo_cargos_locales_naviera
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id))
  WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id));
