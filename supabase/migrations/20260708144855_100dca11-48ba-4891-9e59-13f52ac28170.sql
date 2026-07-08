CREATE OR REPLACE FUNCTION public.cxp_por_capturar()
 RETURNS TABLE(embarque_id uuid, expediente text, cliente_nombre text, costos_presupuestados numeric, monto_facturado numeric, facturas_capturadas integer, ultima_factura_fecha date, dias_desde_ultima_factura integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    e.id,
    e.expediente,
    c.nombre,
    COALESCE(SUM(cc.monto), 0),
    COALESCE((
      SELECT SUM(pf.total) FROM public.proveedor_facturas pf
      WHERE pf.embarque_id = e.id
        AND pf.deleted_at IS NULL
        AND pf.estado::text <> 'Cancelada'
    ), 0),
    (SELECT COUNT(*)::int FROM public.proveedor_facturas pf
       WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL),
    (SELECT MAX(pf.fecha_emision) FROM public.proveedor_facturas pf
       WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL),
    (CURRENT_DATE - (SELECT MAX(pf.fecha_emision) FROM public.proveedor_facturas pf
       WHERE pf.embarque_id = e.id AND pf.deleted_at IS NULL))::int
  FROM public.embarques e
  LEFT JOIN public.clientes c ON c.id = e.cliente_id
  LEFT JOIN public.conceptos_costo cc ON cc.embarque_id = e.id AND cc.deleted_at IS NULL
  WHERE e.deleted_at IS NULL
    AND e.estado::text <> 'Cerrado'
  GROUP BY e.id, e.expediente, c.nombre
  HAVING COALESCE(SUM(cc.monto), 0) > 0
  ORDER BY e.created_at DESC
  LIMIT 500;
$function$;