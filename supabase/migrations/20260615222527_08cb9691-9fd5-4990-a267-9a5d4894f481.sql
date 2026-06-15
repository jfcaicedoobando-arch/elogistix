DROP POLICY IF EXISTS "Tenant write auditoria_revisiones" ON public.auditoria_revisiones;
DROP POLICY IF EXISTS "Staff read auditoria_revisiones" ON public.auditoria_revisiones;

CREATE POLICY "Staff read auditoria_revisiones"
ON public.auditoria_revisiones FOR SELECT
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    organization_id = current_user_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'admin_org'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'gerente_operaciones'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'coordinador_logistico'::app_role)
    )
  )
);

CREATE POLICY "Tenant write auditoria_revisiones"
ON public.auditoria_revisiones FOR ALL
USING (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    organization_id = current_user_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'admin_org'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'gerente_operaciones'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'coordinador_logistico'::app_role)
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    organization_id = current_user_org_id()
    AND (
      has_org_role(auth.uid(), organization_id, 'admin'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'admin_org'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'operador'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'gerente_operaciones'::app_role)
      OR has_org_role(auth.uid(), organization_id, 'coordinador_logistico'::app_role)
    )
  )
);