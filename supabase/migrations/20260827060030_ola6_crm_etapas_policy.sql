-- ============================================================================
-- Ola 6 · O6.3 — Policy de crm_etapas_pipeline alineada al gating de UI
--
-- Problema: la policy "Tenant admin crm_etapas_pipeline" (20260525014353) sólo
-- admitía has_role 'admin'/'super_admin', pero /crm/configuracion se abre a
-- admin_org + gerente_comercial (canAdminTenant || gerente_comercial). Un
-- gerente comercial podía entrar a configurar y fallaba al guardar etapas.
--
-- Cambio: escritura (FOR ALL) para admin, admin_org, gerente_comercial y
-- super_admin — mismo set que la UI (CRM_CONFIG en permissionMatrix.ts) y que
-- la policy "Staff CRUD crm_leads" (20260730185115). La lectura tenant-wide
-- ("Tenant read crm_etapas_pipeline") no cambia: los vendedores siguen
-- necesitando leer etapas para el kanban.
-- ============================================================================

DROP POLICY IF EXISTS "Tenant admin crm_etapas_pipeline" ON public.crm_etapas_pipeline;
CREATE POLICY "Tenant admin crm_etapas_pipeline" ON public.crm_etapas_pipeline
  FOR ALL TO authenticated
  USING (
    ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
    AND (
      public.has_role((SELECT auth.uid()), 'admin')
      OR public.has_role((SELECT auth.uid()), 'admin_org')
      OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
      OR public.has_role((SELECT auth.uid()), 'super_admin')
    )
  )
  WITH CHECK (
    ((organization_id = (SELECT public.current_user_org_id())) OR public.has_role((SELECT auth.uid()), 'super_admin'))
    AND (
      public.has_role((SELECT auth.uid()), 'admin')
      OR public.has_role((SELECT auth.uid()), 'admin_org')
      OR public.has_role((SELECT auth.uid()), 'gerente_comercial')
      OR public.has_role((SELECT auth.uid()), 'super_admin')
    )
  );
