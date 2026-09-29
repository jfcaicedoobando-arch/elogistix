-- Permite a Gerencia de Operaciones generar cotizaciones desde oportunidades
-- vinculadas a prospectos calificados, sin habilitar edición general del CRM.
CREATE POLICY "Gerencia operaciones lee prospectos cotizables"
  ON public.crm_leads
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.rls_tenant_scope_ok(organization_id)
    AND deleted_at IS NULL
    AND estado::text IN ('Calificado', 'Prospecto')
    AND public.has_any_role_in_org(
      (SELECT auth.uid()),
      ARRAY['gerente_operaciones'::public.app_role],
      organization_id
    )
  );
