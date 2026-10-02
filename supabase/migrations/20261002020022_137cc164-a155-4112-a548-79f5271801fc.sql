-- Fase 7 (candado Ola 16): política RESTRICTIVE de tenant activo,
-- mismo patrón que crm_empresas / crm_solicitudes_pricing.
CREATE POLICY crm_tableros_tenant_restrictive ON public.crm_tableros
  AS RESTRICTIVE TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));
CREATE POLICY crm_reportes_tenant_restrictive ON public.crm_reportes
  AS RESTRICTIVE TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));