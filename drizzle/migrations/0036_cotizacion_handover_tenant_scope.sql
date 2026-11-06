-- Forward-only Ola16 boundary. Preserve 0029, its grants and permissive policy.
-- RESTRICTIVE policies can only narrow existing access, never grant it.
DROP POLICY IF EXISTS cotizacion_handovers_tenant_restrictive ON public.cotizacion_handovers;
CREATE POLICY cotizacion_handovers_tenant_restrictive ON public.cotizacion_handovers
  AS RESTRICTIVE FOR ALL TO authenticated
  USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id))
  WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role))) OR public.rls_tenant_scope_ok(organization_id));
