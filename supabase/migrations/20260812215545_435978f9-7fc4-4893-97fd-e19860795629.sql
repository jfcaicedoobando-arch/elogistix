-- v13.545.0 — Separar alertas de cierre operativo (Entregado/EIR) y
-- cierre administrativo (Por liquidar) en embarques_alertas_ids().
CREATE OR REPLACE FUNCTION public.embarques_alertas_ids()
 RETURNS TABLE(embarque_id uuid, tipo text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- Demoras: misma definición que sidebar_alert_counts
  SELECT e.id, 'demora'::text AS tipo
  FROM embarques e
  WHERE e.deleted_at IS NULL
    AND e.eta IS NOT NULL
    AND (current_date - e.eta) >= 7
    AND CASE
       WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
       WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación'
            AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
         CASE
           WHEN current_date < e.etd THEN 'Confirmado'
           WHEN current_date >= e.etd AND current_date < e.eta THEN 'En Tránsito'
           WHEN current_date >= e.eta THEN 'Arribo'
           ELSE e.estado::text
         END
       ELSE e.estado::text
     END = 'Arribo'
    AND (e.organization_id = public.org_scope())

  UNION ALL

  -- Garantías atoradas: depósito >30 días sin liberar
  SELECT DISTINCT e.id, 'garantia'::text
  FROM embarque_garantias_contenedor g
  JOIN embarques e ON e.id = g.embarque_id
  WHERE g.estado = 'depositado'
    AND g.fecha_deposito IS NOT NULL
    AND (current_date - g.fecha_deposito) > 30
    AND e.deleted_at IS NULL
    AND (e.organization_id = public.org_scope())

  UNION ALL

  -- Cierre operativo (Entregado / EIR) y cierre administrativo (Por liquidar):
  -- mismos criterios de pendientes que embarques_admin_pendientes_count.
  SELECT e.id,
         CASE WHEN e.estado = 'Por liquidar' THEN 'admin_pendiente' ELSE 'cierre_operativo' END::text
  FROM embarques e
  WHERE e.deleted_at IS NULL
    AND e.estado IN ('Entregado', 'EIR', 'Por liquidar')
    AND (e.organization_id = public.org_scope())
    AND (
      EXISTS (
        SELECT 1 FROM facturas f
        WHERE f.embarque_id = e.id AND f.deleted_at IS NULL AND f.estado <> 'Cancelada'
        GROUP BY f.embarque_id
        HAVING SUM(f.total) > COALESCE((
          SELECT SUM(pf.monto) FROM pagos_factura pf
          JOIN facturas fi ON fi.id = pf.factura_id
          WHERE fi.embarque_id = e.id AND fi.deleted_at IS NULL AND fi.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM proveedor_facturas pf
        WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        GROUP BY pf.embarque_id
        HAVING SUM(pf.total) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          JOIN proveedor_facturas pfx ON pfx.id = pp.proveedor_factura_id
          WHERE pfx.embarque_id = e.id AND pfx.deleted_at IS NULL AND pfx.estado <> 'Cancelada'
        ),0) + 0.01
      )
      OR EXISTS (
        SELECT 1 FROM documentos_embarque de
        WHERE de.embarque_id = e.id AND de.deleted_at IS NULL
          AND (de.archivo IS NULL OR de.archivo = '')
          AND de.estado <> 'No aplica'
      )
      OR (
        COALESCE((SELECT SUM(total) FROM conceptos_venta WHERE embarque_id = e.id AND deleted_at IS NULL),0)
        > COALESCE((SELECT SUM(total) FROM facturas WHERE embarque_id = e.id AND deleted_at IS NULL AND estado <> 'Cancelada'),0) + 0.01
      )
    );
$function$;

REVOKE ALL ON FUNCTION public.embarques_alertas_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.embarques_alertas_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.embarques_alertas_ids() TO authenticated;