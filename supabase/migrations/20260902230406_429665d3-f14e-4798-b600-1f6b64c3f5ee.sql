-- v13.823.61 · Candado de organización ACTIVA en crm_leads + ACL mínima.
-- Forward-only. No toca datos de negocio.

DROP POLICY IF EXISTS "Gestion leads in-org crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Vendedor own crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Vendedor bolsa crm_leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Lectura in-org crm_leads" ON public.crm_leads;

-- ===== Gestión total in-org (admin / admin_org / super_admin / gerente_comercial)
-- Se separan los comandos: nunca FOR ALL, para que un futuro GRANT DELETE
-- no se convierta en borrado físico autorizado por policy.
CREATE POLICY "Gestion leads in-org select crm_leads"
ON public.crm_leads FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin','gerente_comercial']::public.app_role[], organization_id)
);

CREATE POLICY "Gestion leads in-org insert crm_leads"
ON public.crm_leads FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin','gerente_comercial']::public.app_role[], organization_id)
);

CREATE POLICY "Gestion leads in-org update crm_leads"
ON public.crm_leads FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin','gerente_comercial']::public.app_role[], organization_id)
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['admin','gerente_comercial']::public.app_role[], organization_id)
);

-- ===== Vendedor efectivo: sólo su propio lead, sólo su organización activa.
CREATE POLICY "Vendedor own select crm_leads"
ON public.crm_leads FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], organization_id)
);

CREATE POLICY "Vendedor own insert crm_leads"
ON public.crm_leads FOR INSERT TO authenticated
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], organization_id)
);

CREATE POLICY "Vendedor own update crm_leads"
ON public.crm_leads FOR UPDATE TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], organization_id)
)
WITH CHECK (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id = (SELECT auth.uid())
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], organization_id)
);

-- ===== Bolsa común: sólo lectura; la apropiación pasa por crm_tomar_lead.
CREATE POLICY "Vendedor bolsa crm_leads"
ON public.crm_leads FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND vendedor_id IS NULL
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['vendedor']::public.app_role[], organization_id)
);

-- ===== Lectura in-org: viewer y su jerarquía + operador (roles_jerarquia('viewer')
-- NO incluye 'operador'). Nunca concede escritura.
CREATE POLICY "Lectura in-org crm_leads"
ON public.crm_leads FOR SELECT TO authenticated
USING (
  public.is_org_member(organization_id)
  AND public.rls_tenant_scope_ok(organization_id)
  AND public.has_any_role_in_org((SELECT auth.uid()),
        ARRAY['viewer','operador']::public.app_role[], organization_id)
);

-- ===== ACL exacta: la app nunca borra físicamente ni vacía la tabla.
REVOKE ALL ON TABLE public.crm_leads FROM PUBLIC;
REVOKE ALL ON TABLE public.crm_leads FROM anon;
REVOKE ALL ON TABLE public.crm_leads FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.crm_leads TO authenticated;
GRANT ALL ON TABLE public.crm_leads TO service_role;