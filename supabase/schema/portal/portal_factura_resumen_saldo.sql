-- Fuente canónica de public.portal_factura_resumen_saldo (defecto 7): saldo
-- de la factura del portal desde el agregado completo, no desde listas topadas.
-- Ola v17: el desglose y el saldo salen de la MISMA lectura (antes el saldo
-- venía de public.saldo_factura y podía no cuadrar con total − pagado − NC),
-- y la conversión de NC usa el helper PURO nc_convertida_a_moneda_factura.
CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
 RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric,
               num_pagos integer, num_notas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric; v_estado estado_factura;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total, f.estado
    INTO v_cliente, v_moneda, v_tc, v_total, v_estado
  FROM public.facturas f
  WHERE f.id = p_factura_id AND f.deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_cliente IS NULL
     OR v_cliente NOT IN (SELECT public.current_user_client_ids()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH p AS (
    SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) AS monto, COUNT(*)::int AS n
    FROM public.pagos_factura pf
    WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL
      AND NOT public.pago_rep_anulado(pf.estado_rep)
  ), nc AS (
    SELECT COALESCE(SUM(public.nc_convertida_a_moneda_factura(
             n.monto, n.moneda::text, n.tipo_cambio, v_moneda, v_tc)), 0) AS monto,
           COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         CASE WHEN v_estado IN ('Cancelada','Sustituida') THEN 0
              ELSE COALESCE(v_total, 0) - p.monto - nc.monto END,
         p.n, nc.n
  FROM p, nc;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_factura_resumen_saldo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_factura_resumen_saldo(uuid) TO authenticated, service_role;
