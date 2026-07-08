CREATE OR REPLACE FUNCTION public.reconciliar_conceptos_facturados_legacy()
RETURNS TABLE(
  organization_id uuid,
  conceptos_actualizados bigint,
  embarques_afectados bigint,
  conceptos_ligados_a_proforma bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.auditoria_backfill_legacy', 'on', true);
  PERFORM set_config('app.bypass_cierre', 'on', true);

  RETURN QUERY
  WITH candidatos AS (
    SELECT cv.id            AS concepto_id,
           cv.embarque_id,
           cv.descripcion,
           cv.moneda,
           cv.total,
           e.organization_id
    FROM public.conceptos_venta cv
    JOIN public.embarques e ON e.id = cv.embarque_id
    WHERE cv.estado_facturacion = 'pendiente'
      AND e.estado IN (
        'Confirmado','En Tránsito','Arribo','Llegada','En Aduana',
        'Entregado','EIR','Cerrado'
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.embarque_id = cv.embarque_id
            AND f.estado IN ('Emitida','Pagada','Parcialmente pagada')
        )
        OR EXISTS (
          SELECT 1 FROM public.proformas p
          WHERE p.embarque_id = cv.embarque_id
            AND p.estado_proforma = 'facturada'
        )
      )
  ),
  matches AS (
    SELECT c.concepto_id,
           c.embarque_id,
           c.organization_id,
           (
             SELECT pcc.proforma_id
             FROM public.proforma_conceptos_consolidados pcc
             JOIN public.proformas p ON p.id = pcc.proforma_id
             WHERE p.embarque_id = c.embarque_id
               AND lower(trim(pcc.descripcion)) = lower(trim(c.descripcion))
               AND pcc.moneda = c.moneda
               AND abs(coalesce(pcc.total,0) - coalesce(c.total,0)) < 0.01
             ORDER BY (p.estado_proforma = 'facturada') DESC,
                      p.created_at DESC
             LIMIT 1
           ) AS match_pcc,
           (
             SELECT p2.id
             FROM public.proformas p2
             WHERE p2.embarque_id = c.embarque_id
               AND p2.estado_proforma = 'facturada'
             LIMIT 1
           ) AS single_facturada_probe,
           (
             SELECT count(*)
             FROM public.proformas p3
             WHERE p3.embarque_id = c.embarque_id
               AND p3.estado_proforma = 'facturada'
           ) AS facturadas_count
    FROM candidatos c
  ),
  resueltos AS (
    SELECT m.concepto_id,
           m.embarque_id,
           m.organization_id,
           COALESCE(
             m.match_pcc,
             CASE WHEN m.facturadas_count = 1 THEN m.single_facturada_probe END
           ) AS proforma_id_resuelto
    FROM matches m
  ),
  actualizados AS (
    UPDATE public.conceptos_venta cv
       SET estado_facturacion = 'facturado',
           proforma_id = COALESCE(cv.proforma_id, r.proforma_id_resuelto)
      FROM resueltos r
     WHERE cv.id = r.concepto_id
       AND cv.estado_facturacion = 'pendiente'
    RETURNING cv.id,
              r.embarque_id,
              r.organization_id,
              (cv.proforma_id IS NOT NULL) AS ligado
  )
  SELECT a.organization_id,
         COUNT(*)::bigint,
         COUNT(DISTINCT a.embarque_id)::bigint,
         COUNT(*) FILTER (WHERE a.ligado)::bigint
  FROM actualizados a
  GROUP BY a.organization_id;

  PERFORM set_config('app.bypass_cierre', 'off', true);
  PERFORM set_config('app.auditoria_backfill_legacy', 'off', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reconciliar_conceptos_facturados_legacy() TO service_role;

SELECT * FROM public.reconciliar_conceptos_facturados_legacy();