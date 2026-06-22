DROP FUNCTION IF EXISTS public.cxp_por_pagar();

CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE (
  factura_id uuid, proveedor_nombre text, folio_proveedor text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric, estado_captura text,
  tipo_cambio_usd numeric
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT pf.id, pf.proveedor_nombre, pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                WHERE pp.proveedor_factura_id = pf.id), 0),
    pf.total - COALESCE((SELECT SUM(pp.monto) FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id), 0),
    pf.estado_captura,
    pf.tipo_cambio_usd
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.cxp_por_pagar() TO authenticated;