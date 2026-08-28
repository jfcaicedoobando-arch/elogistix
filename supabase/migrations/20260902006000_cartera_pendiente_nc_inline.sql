-- v13.777.9 · Recierre de orden de replay: la migración equivalente aplicada
-- por la herramienta lleva fecha anterior a 20260902004000 (re-emisión de
-- espejos), que reabría el GRANT del helper. Se re-emite aquí, después, para
-- que un replay desde cero termine con el helper cerrado a service_role.

-- v13.777.9 · FIX3/M1: cartera_pendiente calcula las NC en línea (bajo RLS)
-- para poder volver a cerrar public.nc_aplicadas_en_moneda_factura(uuid) a
-- service_role. Misma cascada de conversión que el helper (si falta TC no se
-- resta: preferimos saldo mayor a dar por pagada una factura que no lo está).

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
      COALESCE((
        SELECT SUM(
          CASE
            WHEN nc.moneda::text = f.moneda::text THEN nc.monto
            WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
              THEN nc.monto * nc.tipo_cambio
            WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
              THEN nc.monto / f.tipo_cambio
            WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
                 AND f.moneda::text <> nc.moneda::text
                 AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
              THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
            ELSE 0
          END)
        FROM public.factura_notas_credito nc
        WHERE nc.factura_id = f.id
          AND nc.deleted_at IS NULL
          AND nc.estado = 'Aplicada'
      ), 0) AS nc_aplicadas
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

-- Helper interno: vuelve a quedar cerrado a service_role.
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.nc_aplicadas_en_moneda_factura(uuid) TO service_role;