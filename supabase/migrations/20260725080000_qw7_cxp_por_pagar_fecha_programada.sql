-- QW7 (tesorería) — expone fecha_programada_pago en cxp_por_pagar() para que
-- la bandeja Por-Pagar pueda mostrar el badge "Prog." y la vista semanal de
-- pagos programados agrupe por COALESCE(fecha_programada_pago, fecha_vencimiento)
-- sin una segunda consulta a proveedor_facturas. Solo agrega una columna al
-- SELECT; no toca guards ni triggers de pagos/anticipos.
DROP FUNCTION IF EXISTS public.cxp_por_pagar();

CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE(
  factura_id uuid, proveedor_nombre text, folio_proveedor text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  estado_captura text, tipo_cambio_usd numeric, fecha_programada_pago date)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH pagos_conv AS (
    SELECT pp.proveedor_factura_id,
           SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)) AS pagado
      FROM public.pagos_proveedor pp
     WHERE pp.deleted_at IS NULL
     GROUP BY pp.proveedor_factura_id
  )
  SELECT pf.id, pf.proveedor_nombre, pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    COALESCE(pc.pagado,0),
    pf.total - COALESCE(pc.pagado,0),
    pf.estado_captura, pf.tipo_cambio_usd, pf.fecha_programada_pago
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  LEFT JOIN pagos_conv pc ON pc.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$function$;
