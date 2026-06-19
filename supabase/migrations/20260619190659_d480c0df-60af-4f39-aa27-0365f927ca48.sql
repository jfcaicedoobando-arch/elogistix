
DROP POLICY IF EXISTS costeo_tarifas_write_org ON public.costeo_tarifas;
CREATE POLICY costeo_tarifas_write_org ON public.costeo_tarifas
FOR ALL
USING (
  (EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_tarifas.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_tarifas.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS costeo_recargos_write_org ON public.costeo_tarifa_recargos;
CREATE POLICY costeo_recargos_write_org ON public.costeo_tarifa_recargos
FOR ALL
USING (
  (EXISTS (SELECT 1 FROM costeo_tarifas t
    JOIN organization_members m ON m.organization_id = t.organization_id
    WHERE t.id = costeo_tarifa_recargos.tarifa_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM costeo_tarifas t
    JOIN organization_members m ON m.organization_id = t.organization_id
    WHERE t.id = costeo_tarifa_recargos.tarifa_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS costeo_agentes_write_org ON public.costeo_agentes;
CREATE POLICY costeo_agentes_write_org ON public.costeo_agentes
FOR ALL
USING (
  (EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_agentes.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  (EXISTS (SELECT 1 FROM organization_members m
    WHERE m.organization_id = costeo_agentes.organization_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin','admin_org','gerente_operaciones','ejecutivo_pricing','operador','coordinador_logistico'])))
  OR has_role(auth.uid(), 'super_admin'::app_role)
);
