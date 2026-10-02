DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_actividad_contacto','crm_actividad_empresa','crm_contactos','crm_empresa_contacto',
    'crm_empresas','crm_oportunidad_contacto','crm_oportunidad_empresa','crm_pricing_opciones',
    'crm_solicitudes_pricing','crm_valores'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_tenant_restrictive', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.rls_tenant_scope_ok(organization_id)) WITH CHECK (public.rls_tenant_scope_ok(organization_id))', t || '_tenant_restrictive', t);
  END LOOP;
END $$;