-- Fix N9: restaurar días vencido con signo (negativo = aún no vence).
CREATE OR REPLACE FUNCTION public.cartera_pendiente()
 RETURNS TABLE(factura_id uuid, numero text, cliente_id uuid, cliente_nombre text, embarque_id uuid, expediente text, fecha_emision date, fecha_vencimiento date, dias_vencido integer, moneda text, total numeric, pagado numeric, saldo numeric, ultimo_contacto date, estado text, cancellation_status text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(
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
                   ELSE NULL
                 END)
                FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    -- N9 (canon signado): positivo = vencida, 0 = vence hoy, negativo = por vencer.
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

-- Fix: la validación de fecha de NC no debe depender de que la factura esté viva;
-- antes una factura archivada devolvía NULL y el usuario veía "fecha inválida".
CREATE OR REPLACE FUNCTION public.assert_nc_fecha_valida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_factura date;
  v_hoy_mexico date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  SELECT f.fecha_emision INTO v_fecha_factura
  FROM public.facturas f
  WHERE f.id = NEW.factura_id;

  IF v_fecha_factura IS NULL OR NEW.fecha_emision IS NULL
     OR NEW.fecha_emision < v_fecha_factura OR NEW.fecha_emision > v_hoy_mexico THEN
    RAISE EXCEPTION 'LC_NC_FECHA_INVALIDA: la fecha debe estar entre la emisión de la factura y hoy'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;