
CREATE OR REPLACE FUNCTION public.backfill_conceptos_venta_facturados()
RETURNS TABLE(organization_id uuid, conceptos_actualizados bigint, embarques_afectados bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH candidatos AS (
    SELECT cv.id AS concepto_id,
           cv.embarque_id,
           e.organization_id,
           (
             SELECT f.id FROM public.facturas f
             WHERE f.embarque_id = cv.embarque_id
               AND f.estado IN ('Emitida','Pagada','Parcialmente pagada')
             ORDER BY f.fecha_emision DESC NULLS LAST, f.created_at DESC
             LIMIT 1
           ) AS factura_id
    FROM public.conceptos_venta cv
    JOIN public.embarques e ON e.id = cv.embarque_id
    WHERE cv.estado_facturacion = 'pendiente'
      AND e.estado IN ('Entregado','Cerrado')
      AND EXISTS (
        SELECT 1 FROM public.facturas f2
        WHERE f2.embarque_id = cv.embarque_id
          AND f2.estado IN ('Emitida','Pagada','Parcialmente pagada')
      )
  ), actualizados AS (
    UPDATE public.conceptos_venta cv
       SET estado_facturacion = 'facturado',
           factura_id = c.factura_id
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
$function$;

CREATE OR REPLACE FUNCTION public.backfill_proformas_aceptadas()
RETURNS TABLE(organization_id uuid, proformas_actualizadas bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH actualizadas AS (
    UPDATE public.proformas p
       SET estado_proforma = 'facturada'
      FROM public.embarques e
     WHERE p.embarque_id = e.id
       AND p.estado_proforma = 'pendiente'
       AND EXISTS (
         SELECT 1 FROM public.facturas f
         WHERE f.embarque_id = p.embarque_id
           AND f.estado IN ('Emitida','Pagada','Parcialmente pagada')
       )
    RETURNING p.id, e.organization_id
  )
  SELECT a.organization_id, COUNT(*)::bigint
  FROM actualizadas a
  GROUP BY a.organization_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.backfill_conceptos_venta_facturados() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_proformas_aceptadas() TO authenticated, service_role;
