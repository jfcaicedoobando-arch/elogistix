-- Extensión70: Por Pagar comparte el saldo exacto de la vista canónica.
-- Las NC no son pagos: pagado conserva sólo pagos; saldo ya descuenta la NC
-- Aplicada/viva en moneda de factura, sin redondear ni convertirla otra vez.
-- Conserva firma, filtros, orden, límite, SECURITY INVOKER, search_path y ACL.
CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE(
  factura_id uuid, proveedor_id uuid, proveedor_nombre text, proveedor_origen text,
  folio_proveedor text, embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  estado_captura text, tipo_cambio_usd numeric, fecha_programada_pago date
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, p.origen_proveedor::text,
    pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    s.pagado, s.saldo,
    pf.estado_captura, pf.tipo_cambio_usd, pf.fecha_programada_pago
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  LEFT JOIN public.proveedores p ON p.id = pf.proveedor_id
  JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$function$;

REVOKE ALL ON FUNCTION public.cxp_por_pagar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_por_pagar() TO authenticated, service_role;
