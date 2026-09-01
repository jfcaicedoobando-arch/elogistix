-- v13.820.7 · Reemisión canónica de dashboard_summary_datos() con timestamp
-- posterior al replay mirror (20260902004000). La BD había quedado con un
-- wrapper que lanzaba LC_DASHBOARD_SIN_PERMISO y bloqueaba el tablero completo
-- para roles operativos. El enmascarado de costos ya lo hace la RPC pública
-- dashboard_summary() (ver supabase/schema/dashboards/dashboard_rpc_costos.sql).
-- Cuerpo 1:1 con supabase/schema/dashboards/dashboard_summary.sql.
CREATE OR REPLACE FUNCTION public.dashboard_summary_datos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy date := current_date;
  v_inicio_mes date := date_trunc('month', v_hoy)::date;
  v_fin_mes date := (date_trunc('month', v_hoy) + interval '1 month' - interval '1 day')::date;
  v_inicio_sig date := (date_trunc('month', v_hoy) + interval '1 month')::date;
  v_fin_sig date := (date_trunc('month', v_hoy) + interval '2 months' - interval '1 day')::date;
BEGIN
  RETURN (
    WITH embarques_base AS (
      SELECT e.id, e.estado::text, e.modo, e.tipo, e.etd, e.eta,
        e.tipo_cambio_eur,
        CASE
          WHEN e.estado = 'Borrador' THEN 'Borrador'
          WHEN e.estado IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado') THEN e.estado::text
          WHEN e.modo = 'Marítimo' AND e.tipo = 'Importación' AND e.etd IS NOT NULL AND e.eta IS NOT NULL THEN
            CASE
              WHEN v_hoy < e.etd THEN 'Confirmado'
              WHEN v_hoy >= e.etd AND v_hoy < e.eta THEN 'En Tránsito'
              WHEN v_hoy >= e.eta THEN 'Arribo'
              ELSE e.estado::text
            END
          ELSE e.estado::text
        END AS estado_real
      FROM embarques e
      WHERE e.deleted_at IS NULL
        AND (e.organization_id = public.org_scope())
    ),
    profit AS (SELECT * FROM profit_por_embarque()),
    activos AS (SELECT * FROM embarques_base WHERE estado_real NOT IN ('Borrador','EIR','Por liquidar','Cerrado','Cancelado')),
    conteo AS (
      SELECT jsonb_build_object(
        'Confirmado', count(*) FILTER (WHERE estado_real = 'Confirmado'),
        'En Tránsito', count(*) FILTER (WHERE estado_real = 'En Tránsito'),
        'Arribo', count(*) FILTER (WHERE estado_real = 'Arribo'),
        'En Aduana', count(*) FILTER (WHERE estado_real = 'En Aduana'),
        'Entregado', count(*) FILTER (WHERE estado_real = 'Entregado'),
        'EIR', count(*) FILTER (WHERE estado_real = 'EIR'),
        'Por liquidar', count(*) FILTER (WHERE estado_real = 'Por liquidar')
      ) AS val
      FROM embarques_base
    ),
    gastos_op_facturas AS (
      -- FIX BL-11: EUR usa el TC del embarque ligado y, si no hay, el TC DOF
      -- vigente a fecha_emision (LEFT JOIN LATERAL sobre tipos_cambio_dof).
      SELECT COALESCE(SUM(
        CASE
          WHEN pf.moneda = 'MXN' THEN pf.total
          WHEN pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1 THEN pf.total * pf.tipo_cambio_usd
          WHEN pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn) > 1
               THEN pf.total * COALESCE(eb.tipo_cambio_eur, dof.eur_mxn)
          ELSE NULL
        END
      ), 0) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
    ),
    gastos_op_sin_tc AS (
      -- FIX BL-11: mismo fallback DOF — una factura EUR con TC DOF disponible ya
      -- no cuenta como "sin TC".
      SELECT COUNT(*) AS val
      FROM proveedor_facturas pf
      JOIN presupuesto_categorias pc ON pc.id = pf.categoria_presupuesto_id
      LEFT JOIN embarques_base eb ON eb.id = pf.embarque_id
      LEFT JOIN LATERAL (
        SELECT d.eur_mxn
          FROM public.tipos_cambio_dof d
         WHERE d.fecha <= pf.fecha_emision
         ORDER BY d.fecha DESC
         LIMIT 1
      ) dof ON pf.moneda = 'EUR' AND eb.tipo_cambio_eur IS NULL
      WHERE pc.tipo_contable IN ('Venta','Administracion')
        AND pf.deleted_at IS NULL
        AND pf.fecha_emision BETWEEN v_inicio_mes AND v_fin_mes
        AND (pf.organization_id = public.org_scope())
        AND pf.moneda <> 'MXN'
        AND NOT (pf.moneda = 'USD' AND pf.tipo_cambio_usd > 1)
        AND NOT (pf.moneda = 'EUR' AND COALESCE(eb.tipo_cambio_eur, dof.eur_mxn, 0) > 1)
    ),
    gastos_op_comisiones AS (
      SELECT COALESCE(SUM(total_mxn), 0) AS val
      FROM liquidaciones_comision
      WHERE periodo = to_char(v_inicio_mes, 'YYYY-MM')
        AND (organization_id = public.org_scope())
    ),
    arribos_mes AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'yaLlegaron', count(*) FILTER (WHERE eb.estado_real IN ('Arribo','En Aduana','Entregado','EIR','Por liquidar','Cerrado')),
        'enCamino', count(*) FILTER (WHERE eb.estado_real IN ('Confirmado','En Tránsito')),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0),
        'ventaMxnFromUsd', COALESCE(sum(COALESCE(p.venta_mxn_from_usd, 0)), 0),
        'costoMxnFromUsd', COALESCE(sum(COALESCE(p.costo_mxn_from_usd, 0)), 0),
        'ventaMxnFromEur', COALESCE(sum(COALESCE(p.venta_mxn_from_eur, 0)), 0),
        'costoMxnFromEur', COALESCE(sum(COALESCE(p.costo_mxn_from_eur, 0)), 0),
        'ventaMxnNative', COALESCE(sum(COALESCE(p.venta_mxn_native, 0)), 0),
        'costoMxnNative', COALESCE(sum(COALESCE(p.costo_mxn_native, 0)), 0),
        'profitUSD', COALESCE(sum(COALESCE(p.venta_usd, 0) - COALESCE(p.costo_usd, 0)), 0),
        'gastosOperativosMXN',
          COALESCE((SELECT val FROM gastos_op_facturas), 0)
          + COALESCE((SELECT val FROM gastos_op_comisiones), 0),
        'gastosOperativosSinTC', COALESCE((SELECT val FROM gastos_op_sin_tc), 0)
      ) AS val
      FROM embarques_base eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_mes AND eb.eta <= v_fin_mes
    ),
    resumen_sig AS (
      SELECT jsonb_build_object(
        'total', count(*),
        'ventaUSD', COALESCE(sum(COALESCE(p.venta_usd, 0)), 0),
        'costoUSD', COALESCE(sum(COALESCE(p.costo_usd, 0)), 0),
        'ventaMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0)), 0),
        'costoMXN', COALESCE(sum(COALESCE(p.costo_mxn, 0)), 0),
        'profitMXN', COALESCE(sum(COALESCE(p.venta_mxn, 0) - COALESCE(p.costo_mxn, 0)), 0)
      ) AS val
      FROM activos eb
      LEFT JOIN profit p ON p.embarque_id = eb.id
      WHERE eb.eta IS NOT NULL AND eb.eta >= v_inicio_sig AND eb.eta <= v_fin_sig
    )
    SELECT jsonb_build_object(
      'totalActivos', (SELECT count(*) FROM activos),
      'conteoPorEstado', COALESCE((SELECT val FROM conteo), '{}'::jsonb),
      'arribosEsteMes', COALESCE((SELECT val FROM arribos_mes), '{}'::jsonb),
      'resumenMesSiguiente', COALESCE((SELECT val FROM resumen_sig), '{}'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.dashboard_summary_datos() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_summary_datos() TO service_role;