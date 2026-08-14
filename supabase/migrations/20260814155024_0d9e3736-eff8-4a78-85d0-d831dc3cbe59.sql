-- Ola 14 · Sprint 05 · R5BD-05
-- pagos_factura.refacturacion_id se creó sin llave foránea
-- (20260813200357_…:77-81): referencia colgante posible hacia refacturaciones.id.
-- Patrón del repo para tablas con historial: NOT VALID + VALIDATE diferido.
-- ON DELETE RESTRICT: las refacturaciones no se borran, se archivan
-- (cerrar_caso_refacturacion sólo cambia estado).
--
-- PASO PREVIO (manual, antes del VALIDATE CONSTRAINT):
--   SELECT p.id, p.refacturacion_id
--     FROM public.pagos_factura p
--     LEFT JOIN public.refacturaciones r ON r.id = p.refacturacion_id
--    WHERE p.refacturacion_id IS NOT NULL AND r.id IS NULL;
-- Si devuelve filas, sanearlas (refacturacion_id = NULL sólo si se confirma
-- que el caso no existe; nunca inventar el id) antes de validar.

ALTER TABLE public.pagos_factura
  DROP CONSTRAINT IF EXISTS pagos_factura_refacturacion_fk;
ALTER TABLE public.pagos_factura
  ADD CONSTRAINT pagos_factura_refacturacion_fk
  FOREIGN KEY (refacturacion_id)
  REFERENCES public.refacturaciones(id)
  ON DELETE RESTRICT
  NOT VALID;

-- Ejecutar manualmente tras sanear históricos:
-- ALTER TABLE public.pagos_factura VALIDATE CONSTRAINT pagos_factura_refacturacion_fk;

-- Ola 14 · Sprint 05 · R5BD-04
-- Las policies de refacturaciones admitían tesorero/ejecutivo_cobranza (vía
-- es_escritor_financiero), permitiendo escritura directa que se salta las
-- validaciones SAT de abrir_caso_refacturacion, y excluían auxiliar_contable
-- que las RPC sí autorizan. Se alinean al set de _assert_refacturador.
-- SELECT intacto. Idempotente: DROP POLICY IF EXISTS + CREATE POLICY.

DROP POLICY IF EXISTS "Fiscal write refacturaciones" ON public.refacturaciones;
CREATE POLICY "Fiscal write refacturaciones"
ON public.refacturaciones FOR INSERT TO authenticated
WITH CHECK (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  AND (
    (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
        AND om.organization_id = refacturaciones.organization_id
        AND om.role IN ('admin_org','admin','contador','auxiliar_contable')
    )
  )
);

DROP POLICY IF EXISTS "Fiscal update refacturaciones" ON public.refacturaciones;
CREATE POLICY "Fiscal update refacturaciones"
ON public.refacturaciones FOR UPDATE TO authenticated
USING (
  (
    organization_id = (SELECT public.current_user_org_id())
    OR (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  AND (
    (SELECT public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = (SELECT auth.uid())
        AND om.organization_id = refacturaciones.organization_id
        AND om.role IN ('admin_org','admin','contador','auxiliar_contable')
    )
  )
);