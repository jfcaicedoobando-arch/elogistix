-- FIX-H6-08 / FIX-H4-08: re-aplica permisos explícitos de funciones SECURITY DEFINER
-- (anticipos, conciliacion_resumen, pago en lote) y vuelve idempotentes las
-- políticas/índices recientes.

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_movimiento_pago_consistente() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_anticipo_proveedor(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.conciliacion_resumen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conciliacion_resumen(uuid) TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_lote_id
  ON public.pagos_proveedor(lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bbva_movimientos_pago_proveedor_lote_id
  ON public.bbva_movimientos(pago_proveedor_lote_id) WHERE pago_proveedor_lote_id IS NOT NULL;

DROP POLICY IF EXISTS "Operativos y admin actualizan puertos" ON public.puertos;
CREATE POLICY "Operativos y admin actualizan puertos"
ON public.puertos FOR UPDATE TO authenticated
USING (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
)
WITH CHECK (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
);

DROP POLICY IF EXISTS "Operativos y admin agregan puertos" ON public.puertos;
CREATE POLICY "Operativos y admin agregan puertos"
ON public.puertos FOR INSERT TO authenticated
WITH CHECK (
  (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'admin_org'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'gerente_operaciones'::app_role))
  OR (SELECT public.has_role((SELECT auth.uid()), 'coordinador_logistico'::app_role))
);

DROP POLICY IF EXISTS "Tenant read pagos_proveedor_lote" ON public.pagos_proveedor_lote;
CREATE POLICY "Tenant read pagos_proveedor_lote"
ON public.pagos_proveedor_lote FOR SELECT TO authenticated
USING (
  (organization_id = (SELECT public.current_user_org_id()))
  OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
);

DROP POLICY IF EXISTS "Escritor financiero write pagos_proveedor_lote" ON public.pagos_proveedor_lote;
CREATE POLICY "Escritor financiero write pagos_proveedor_lote"
ON public.pagos_proveedor_lote FOR INSERT TO authenticated
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND public.es_escritor_financiero((SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Escritor financiero update pagos_proveedor_lote" ON public.pagos_proveedor_lote;
CREATE POLICY "Escritor financiero update pagos_proveedor_lote"
ON public.pagos_proveedor_lote FOR UPDATE TO authenticated
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND public.es_escritor_financiero((SELECT auth.uid()))
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
   OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role)))
  AND public.es_escritor_financiero((SELECT auth.uid()))
);