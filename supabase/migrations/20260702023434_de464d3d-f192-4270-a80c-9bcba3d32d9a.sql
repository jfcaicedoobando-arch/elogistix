
-- proformas
DROP POLICY IF EXISTS "Tenant CRUD proformas" ON public.proformas;
CREATE POLICY "Tenant CRUD proformas" ON public.proformas
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- proforma_conceptos_consolidados
DROP POLICY IF EXISTS "Tenant CRUD pcc" ON public.proforma_conceptos_consolidados;
CREATE POLICY "Tenant CRUD pcc" ON public.proforma_conceptos_consolidados
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- conceptos_venta (agrega admin_org)
DROP POLICY IF EXISTS "Tenant CRUD conceptos_venta" ON public.conceptos_venta;
CREATE POLICY "Tenant CRUD conceptos_venta" ON public.conceptos_venta
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

-- facturas (agrega admin_org)
DROP POLICY IF EXISTS "Tenant CRUD facturas" ON public.facturas;
CREATE POLICY "Tenant CRUD facturas" ON public.facturas
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );
