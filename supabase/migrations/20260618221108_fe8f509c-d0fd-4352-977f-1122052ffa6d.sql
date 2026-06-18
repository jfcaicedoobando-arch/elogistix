DROP POLICY IF EXISTS costeo_rutas_write_org ON public.costeo_rutas;

CREATE POLICY costeo_rutas_write_org ON public.costeo_rutas
FOR ALL
USING (
  (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_rutas.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])
  )) OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_rutas.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])
  )) OR has_role(auth.uid(), 'super_admin'::app_role)
);