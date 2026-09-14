-- Fuente canónica de public.cartera_pendiente_total() (N10, v13.823.390).
-- Espejo 1:1 de la migración que la crea. Al modificar: edita ESTE archivo y
-- genera la migración con el mismo cuerpo.
-- Existe porque public.cartera_pendiente() termina en LIMIT 500 y la UI
-- necesita saber si el listado quedó truncado. Corre bajo RLS nativo
-- (SECURITY INVOKER): sólo cuenta lo que el usuario puede leer.

CREATE OR REPLACE FUNCTION public.cartera_pendiente_total()
RETURNS bigint
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  SELECT count(*)::bigint
  FROM public.facturas f
  WHERE f.deleted_at IS NULL
    AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
    AND (
      f.total
      - COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                   WHERE pf.factura_id = f.id AND pf.deleted_at IS NULL
                     AND NOT public.pago_rep_anulado(pf.estado_rep)), 0)
      - COALESCE((
          SELECT SUM(public.nc_convertida_a_moneda_factura(
                   nc.monto, nc.moneda::text, nc.tipo_cambio, f.moneda::text, f.tipo_cambio))
          FROM public.factura_notas_credito nc
          WHERE nc.factura_id = f.id
            AND nc.deleted_at IS NULL
            AND nc.estado = 'Aplicada'
        ), 0)
    ) > 0.005
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente_total() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente_total() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente_total() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente_total() TO service_role;
