-- Amplía la política Tenant CRUD de pagos_factura para incluir los roles
-- financieros modernos (admin_org, auxiliar_contable, ejecutivo_cobranza)
-- además de los ya soportados (admin, operador, contador, super_admin).
DROP POLICY IF EXISTS "Tenant CRUD pagos_factura" ON public.pagos_factura;

CREATE POLICY "Tenant CRUD pagos_factura"
  ON public.pagos_factura
  FOR ALL
  USING (
    (
      organization_id = current_user_org_id()
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
      OR has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    (
      organization_id = current_user_org_id()
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'admin_org'::app_role)
      OR has_role(auth.uid(), 'operador'::app_role)
      OR has_role(auth.uid(), 'contador'::app_role)
      OR has_role(auth.uid(), 'auxiliar_contable'::app_role)
      OR has_role(auth.uid(), 'ejecutivo_cobranza'::app_role)
      OR has_role(auth.uid(), 'super_admin'::app_role)
    )
  );