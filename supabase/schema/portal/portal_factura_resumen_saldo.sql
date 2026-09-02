-- Fuente canónica de public.portal_factura_resumen_saldo (defecto 7): saldo
-- de la factura del portal desde el agregado completo, no desde listas topadas.
CREATE OR REPLACE FUNCTION public.portal_factura_resumen_saldo(p_factura_id uuid)
 RETURNS TABLE(total numeric, pagado numeric, notas_credito numeric, saldo numeric,
               num_pagos integer, num_notas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente uuid; v_moneda text; v_tc numeric; v_total numeric;
BEGIN
  SELECT f.cliente_id, f.moneda::text, f.tipo_cambio, f.total
    INTO v_cliente, v_moneda, v_tc, v_total
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
  ), nc AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN n.moneda::text = v_moneda THEN n.monto
        WHEN v_moneda = 'MXN' AND n.moneda::text <> 'MXN' AND n.tipo_cambio > 1
          THEN n.monto * n.tipo_cambio
        WHEN v_moneda <> 'MXN' AND n.moneda::text = 'MXN' AND v_tc > 1
          THEN n.monto / v_tc
        WHEN v_moneda <> 'MXN' AND n.moneda::text <> 'MXN'
             AND v_moneda <> n.moneda::text
             AND n.tipo_cambio > 1 AND v_tc > 1
          THEN (n.monto * n.tipo_cambio) / v_tc
        ELSE 0
      END), 0) AS monto, COUNT(*)::int AS n
    FROM public.factura_notas_credito n
    WHERE n.factura_id = p_factura_id AND n.deleted_at IS NULL AND n.estado = 'Aplicada'
  )
  SELECT COALESCE(v_total, 0), p.monto, nc.monto,
         public.saldo_factura(p_factura_id), p.n, nc.n
  FROM p, nc;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_factura_resumen_saldo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_factura_resumen_saldo(uuid) TO authenticated, service_role;
