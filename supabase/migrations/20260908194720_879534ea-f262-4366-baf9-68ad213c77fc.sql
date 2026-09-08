CREATE POLICY "Scope tenant activo super admin"
ON public.catalogo_org_desactivado
AS RESTRICTIVE
FOR ALL
USING ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id))
WITH CHECK ((NOT (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))) OR public.rls_tenant_scope_ok(organization_id));