DROP POLICY IF EXISTS "Tenant CRUD proveedor_facturas" ON public.proveedor_facturas;

CREATE POLICY "Tenant CRUD proveedor_facturas"
ON public.proveedor_facturas
FOR ALL
USING (
  (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
    OR public.has_role(auth.uid(), 'auxiliar_contable'::public.app_role)
    OR public.has_role(auth.uid(), 'tesorero'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = proveedor_facturas.organization_id
        AND om.role IN (
          'admin_org'::public.app_role,
          'admin'::public.app_role,
          'contador'::public.app_role,
          'auxiliar_contable'::public.app_role,
          'tesorero'::public.app_role
        )
    )
  )
)
WITH CHECK (
  (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
    OR public.has_role(auth.uid(), 'auxiliar_contable'::public.app_role)
    OR public.has_role(auth.uid(), 'tesorero'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = proveedor_facturas.organization_id
        AND om.role IN (
          'admin_org'::public.app_role,
          'admin'::public.app_role,
          'contador'::public.app_role,
          'auxiliar_contable'::public.app_role,
          'tesorero'::public.app_role
        )
    )
  )
);