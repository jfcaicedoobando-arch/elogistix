DROP POLICY IF EXISTS "Tenant CRUD proveedores" ON public.proveedores;

CREATE POLICY "Tenant CRUD proveedores"
ON public.proveedores
FOR ALL
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);