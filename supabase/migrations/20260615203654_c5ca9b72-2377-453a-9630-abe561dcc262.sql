ALTER TABLE public.conceptos_venta
  DROP CONSTRAINT IF EXISTS conceptos_venta_estado_facturacion_check;

ALTER TABLE public.conceptos_venta
  ADD CONSTRAINT conceptos_venta_estado_facturacion_check
  CHECK (estado_facturacion IN ('pendiente', 'en_proforma', 'facturado'));

CREATE OR REPLACE FUNCTION public.backfill_conceptos_venta_facturados()
RETURNS TABLE(organization_id uuid, conceptos_actualizados bigint, embarques_afectados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT cv.id AS concepto_id,
           cv.embarque_id,
           e.organization_id
    FROM public.conceptos_venta cv
    JOIN public.embarques e ON e.id = cv.embarque_id
    WHERE cv.estado_facturacion = 'pendiente'
      AND e.estado IN ('Entregado','Cerrado')
      AND EXISTS (
        SELECT 1
        FROM public.facturas f
        WHERE f.embarque_id = cv.embarque_id
          AND f.estado IN ('Emitida','Pagada','Parcialmente pagada')
      )
  ), actualizados AS (
    UPDATE public.conceptos_venta cv
       SET estado_facturacion = 'facturado'
      FROM candidatos c
     WHERE cv.id = c.concepto_id
    RETURNING cv.id, c.embarque_id, c.organization_id
  )
  SELECT a.organization_id,
         COUNT(*)::bigint AS conceptos_actualizados,
         COUNT(DISTINCT a.embarque_id)::bigint AS embarques_afectados
  FROM actualizados a
  GROUP BY a.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_conceptos_venta_facturados() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_proformas_aceptadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_auditoria_backfill_legacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_conceptos_venta_facturados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_proformas_aceptadas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_auditoria_backfill_legacy() TO authenticated, service_role;