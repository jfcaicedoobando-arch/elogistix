DROP POLICY IF EXISTS "admin_org puede leer credenciales facturapi de su org"
  ON public.facturapi_credenciales;
DROP POLICY IF EXISTS "admin_org puede gestionar credenciales facturapi de su org"
  ON public.facturapi_credenciales;

CREATE POLICY "leer credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  );

CREATE POLICY "gestionar credenciales facturapi de su org"
  ON public.facturapi_credenciales
  FOR ALL
  TO authenticated
  USING (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  )
  WITH CHECK (
    public.is_org_admin(auth.uid(), organization_id)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
  );