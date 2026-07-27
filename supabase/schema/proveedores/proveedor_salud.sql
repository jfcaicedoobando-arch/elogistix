-- Canonical schema para public.proveedor_salud
-- Sincronizado en 13.320.2 (audit RPC columns).
--
-- Fix: antes intentaba usar `embarques.agente_origen_id` y `agente_destino_id`
-- (columnas inexistentes) protegido por `EXCEPTION WHEN undefined_column`, lo
-- que devolvía `embarques_activos = 0` en silencio. Ahora usa la columna real
-- `embarques.agente_id` y sin `EXCEPTION`, para que cualquier regresión falle
-- ruidosamente en vez de mentir el KPI.
CREATE OR REPLACE FUNCTION public.proveedor_salud(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_facturas_12m integer;
  v_monto_12m numeric;
  v_saldo numeric;
  v_dias_promedio numeric;
  v_pct_a_tiempo numeric;
  v_nc_count integer;
  v_nc_monto numeric;
  v_embarques_activos integer;
  v_mensual jsonb;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(total),0)
  INTO v_facturas_12m, v_monto_12m
  FROM public.proveedor_facturas
  WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
    AND deleted_at IS NULL AND estado <> 'Cancelada'
    AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months');

  SELECT COALESCE(SUM(GREATEST(pf.total - COALESCE(pg.pagado,0) - COALESCE(nc.aplicado,0),0)),0)
  INTO v_saldo
  FROM public.proveedor_facturas pf
  LEFT JOIN (SELECT proveedor_factura_id, SUM(monto) pagado FROM public.pagos_proveedor WHERE deleted_at IS NULL GROUP BY 1) pg
    ON pg.proveedor_factura_id = pf.id
  LEFT JOIN (SELECT proveedor_factura_id, SUM(monto) aplicado FROM public.proveedor_notas_credito WHERE estado='Aplicada' GROUP BY 1) nc
    ON nc.proveedor_factura_id = pf.id
  WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
    AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada';

  WITH pagos_x_fact AS (
    SELECT pf.id, pf.fecha_emision, MAX(pp.fecha_pago) AS fecha_ultimo_pago,
           pf.fecha_vencimiento, SUM(pp.monto) AS pagado, pf.total
    FROM public.proveedor_facturas pf
    JOIN public.pagos_proveedor pp ON pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
    GROUP BY pf.id, pf.fecha_emision, pf.fecha_vencimiento, pf.total
    HAVING SUM(pp.monto) >= pf.total - 0.01
  )
  SELECT
    AVG(fecha_ultimo_pago - fecha_emision)::numeric,
    CASE WHEN COUNT(*)=0 THEN NULL
         ELSE 100.0 * SUM(CASE WHEN fecha_vencimiento IS NULL OR fecha_ultimo_pago <= fecha_vencimiento THEN 1 ELSE 0 END) / COUNT(*) END
  INTO v_dias_promedio, v_pct_a_tiempo FROM pagos_x_fact;

  SELECT COUNT(*), COALESCE(SUM(monto),0)
  INTO v_nc_count, v_nc_monto
  FROM public.proveedor_notas_credito nc
  JOIN public.proveedor_facturas pf ON pf.id = nc.proveedor_factura_id
  WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
    AND nc.estado <> 'Cancelada';

  SELECT COUNT(DISTINCT e.id) INTO v_embarques_activos
  FROM public.embarques e
  WHERE e.organization_id = v_oid
    AND (e.naviera_id = p_proveedor_id OR e.agente_id = p_proveedor_id)
    AND COALESCE(e.estado::text,'') NOT IN ('Entregado','Cancelado','Cerrado');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY mes), '[]'::jsonb)
  INTO v_mensual
  FROM (
    SELECT to_char(date_trunc('month', fecha_emision), 'YYYY-MM') AS mes,
           SUM(total) AS monto, COUNT(*) AS facturas
    FROM public.proveedor_facturas
    WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
      AND deleted_at IS NULL AND estado <> 'Cancelada'
      AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'facturas_12m', v_facturas_12m,
    'monto_12m', v_monto_12m,
    'saldo_actual', v_saldo,
    'dias_promedio_pago', v_dias_promedio,
    'pct_pagadas_a_tiempo', v_pct_a_tiempo,
    'notas_credito_count', v_nc_count,
    'notas_credito_monto', v_nc_monto,
    'embarques_activos', v_embarques_activos,
    'mensual', v_mensual
  );
END;
$function$;
