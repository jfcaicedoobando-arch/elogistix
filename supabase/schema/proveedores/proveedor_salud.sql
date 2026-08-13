-- Canonical schema para public.proveedor_salud
-- Sincronizado en 13.320.2 (audit RPC columns).
--
-- Fix: antes se intentaba filtrar por dos columnas inexistentes en
-- `embarques` (variantes "origen"/"destino" de agente) protegido por un
-- bloque que atrapaba el error de columna faltante, lo que devolvía
-- `embarques_activos = 0` en silencio. Ahora usa la columna real
-- `embarques.agente_id` y sin captura de errores, para que cualquier
-- regresión falle ruidosamente en vez de mentir el KPI.
--
-- Ola 12 · R3FE-01: todos los KPIs se valúan a MXN con el TC DOF vigente
-- (antes se sumaban USD + MXN como si fueran la misma unidad). Cuando falta
-- el TC del DOF, los importes en divisa se EXCLUYEN y `tc.faltante = true`
-- para que la UI avise en vez de mostrar un total mentiroso.
CREATE OR REPLACE FUNCTION public.proveedor_salud(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_usd numeric;
  v_eur numeric;
  v_faltante boolean := false;
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
  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  SELECT COUNT(*),
         COALESCE(SUM(public.a_mxn(total, moneda::text, v_usd, v_eur)), 0),
         BOOL_OR(moneda::text <> 'MXN' AND public.a_mxn(total, moneda::text, v_usd, v_eur) IS NULL)
  INTO v_facturas_12m, v_monto_12m, v_faltante
  FROM public.proveedor_facturas
  WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
    AND deleted_at IS NULL AND estado <> 'Cancelada'
    AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months');

  -- Saldo: el saldo de cada factura se calcula en SU moneda (R3P-01) y luego
  -- se valúa a MXN; así no se mezclan divisas en la resta.
  WITH saldos AS (
    SELECT pf.moneda::text AS moneda,
           GREATEST(
             COALESCE(pf.total, 0)
             - COALESCE((SELECT SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text))
                         FROM public.pagos_proveedor pp
                         WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0)
             - COALESCE((SELECT SUM(nc.monto) FROM public.proveedor_notas_credito nc
                         WHERE nc.proveedor_factura_id = pf.id AND nc.deleted_at IS NULL
                           AND nc.estado = 'Aplicada'), 0)
           , 0) AS saldo
    FROM public.proveedor_facturas pf
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
  )
  SELECT COALESCE(SUM(public.a_mxn(saldo, moneda, v_usd, v_eur)), 0),
         v_faltante OR COALESCE(BOOL_OR(moneda <> 'MXN' AND public.a_mxn(saldo, moneda, v_usd, v_eur) IS NULL), false)
  INTO v_saldo, v_faltante
  FROM saldos;

  -- Días de pago: comparación en la moneda de la factura (R3P-01).
  WITH pagos_x_fact AS (
    SELECT pf.id, pf.fecha_emision, MAX(pp.fecha_pago) AS fecha_ultimo_pago,
           pf.fecha_vencimiento,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado,
           pf.total
    FROM public.proveedor_facturas pf
    JOIN public.pagos_proveedor pp ON pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
    GROUP BY pf.id, pf.fecha_emision, pf.fecha_vencimiento, pf.total
    HAVING SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) >= pf.total - 0.01
  )
  SELECT
    AVG(fecha_ultimo_pago - fecha_emision)::numeric,
    CASE WHEN COUNT(*)=0 THEN NULL
         ELSE 100.0 * SUM(CASE WHEN fecha_vencimiento IS NULL OR fecha_ultimo_pago <= fecha_vencimiento THEN 1 ELSE 0 END) / COUNT(*) END
  INTO v_dias_promedio, v_pct_a_tiempo FROM pagos_x_fact;

  SELECT COUNT(*),
         COALESCE(SUM(public.a_mxn(nc.monto, nc.moneda::text, v_usd, v_eur)), 0),
         v_faltante OR COALESCE(BOOL_OR(nc.moneda::text <> 'MXN' AND public.a_mxn(nc.monto, nc.moneda::text, v_usd, v_eur) IS NULL), false)
  INTO v_nc_count, v_nc_monto, v_faltante
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
           SUM(public.a_mxn(total, moneda::text, v_usd, v_eur)) AS monto,
           COUNT(*) AS facturas
    FROM public.proveedor_facturas
    WHERE proveedor_id = p_proveedor_id AND organization_id = v_oid
      AND deleted_at IS NULL AND estado <> 'Cancelada'
      AND fecha_emision >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'facturas_12m', v_facturas_12m,
    'monto_12m', ROUND(COALESCE(v_monto_12m, 0), 2),
    'saldo_actual', ROUND(COALESCE(v_saldo, 0), 2),
    'dias_promedio_pago', v_dias_promedio,
    'pct_pagadas_a_tiempo', v_pct_a_tiempo,
    'notas_credito_count', v_nc_count,
    'notas_credito_monto', ROUND(COALESCE(v_nc_monto, 0), 2),
    'embarques_activos', v_embarques_activos,
    'mensual', v_mensual,
    'moneda', 'MXN',
    'tc', jsonb_build_object('usd_mxn', v_usd, 'eur_mxn', v_eur, 'faltante', COALESCE(v_faltante, false))
  );
END;
$function$;
