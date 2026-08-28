-- Fuente canónica de public.cartera_pendiente() (Ola 6 · O6-SCHEMA).
-- 1:1 con supabase/migrations/20260813230758_55fd47bb-2d11-4849-9db5-14215387682a.sql.
-- Firma vigente: 16 columnas (factura_id … cancellation_status). NO renombrar columnas de salida (42P13).
-- v13.592.0: se agregó cancellation_status para excluir del cobro en lote las
-- facturas con cancelación en trámite ante el SAT (LC_FACTURA_EN_CANCELACION).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

-- v13.777.0 (auditoría 3-3 · C1b): las notas de crédito se leen del canon
-- public.nc_aplicadas_en_moneda_factura para que estado, cobros y reportes
-- de antigüedad usen exactamente el mismo saldo.

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text, cancellation_status text)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE(public.nc_aplicadas_en_moneda_factura(f.id), 0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    ((now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO service_role;
