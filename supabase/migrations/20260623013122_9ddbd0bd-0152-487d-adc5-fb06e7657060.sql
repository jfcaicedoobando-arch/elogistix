DROP POLICY IF EXISTS "Tenant CRUD proveedor_facturas" ON public.proveedor_facturas;

CREATE POLICY "Tenant CRUD proveedor_facturas"
ON public.proveedor_facturas
FOR ALL
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
    OR has_role(auth.uid(), 'tesorero'::app_role)
  )
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
    OR has_role(auth.uid(), 'tesorero'::app_role)
  )
);

DROP POLICY IF EXISTS "Tenant CRUD proveedor_facturas_conceptos" ON public.proveedor_facturas_conceptos;

CREATE POLICY "Tenant CRUD proveedor_facturas_conceptos"
ON public.proveedor_facturas_conceptos
FOR ALL
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
    OR has_role(auth.uid(), 'tesorero'::app_role)
  )
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
    OR has_role(auth.uid(), 'tesorero'::app_role)
  )
);