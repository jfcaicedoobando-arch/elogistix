-- ============================================================
-- DEFECTO 8: rentabilidad sin tipo de cambio presentada como exacta.
--
-- `public.profit_por_cliente` ya calcula `embarques_sin_tc` (embarques con al
-- menos un concepto de venta/costo que no pudo convertirse a MXN por falta de
-- tipo de cambio), pero `public.reportes_resumen` descartaba la señal al
-- construir el jsonb de salida: la UI mostraba venta/costo/utilidad como
-- cifras exactas aunque una parte del cálculo estuviera incompleta.
--
-- Se propaga `embarques_sin_tc` por cliente (ya viene en `base`, sin costo
-- extra) y el total agregado en los KPIs, para que la UI y la exportación
-- puedan marcar la cifra como incompleta en vez de presentarla como exacta.
-- ============================================================
CREATE OR REPLACE FUNCTION public.reportes_resumen(
  p_fecha_desde date DEFAULT NULL,
  p_fecha_hasta date DEFAULT NULL,
  p_modo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
  v_kpis jsonb;
BEGIN
  WITH base AS (
    SELECT * FROM public.profit_por_cliente(p_fecha_desde, p_fecha_hasta, p_modo)
  ),
  calc AS (
    SELECT
      cliente_id,
      cliente_nombre,
      total_embarques,
      venta_usd,
      costo_usd,
      (venta_usd - costo_usd) AS profit_usd,
      CASE WHEN venta_usd > 0
           THEN ((venta_usd - costo_usd) / venta_usd) * 100
           ELSE 0
      END AS margen,
      embarques_sin_tc
    FROM base
  )
  SELECT
    jsonb_agg(to_jsonb(c.*) ORDER BY c.profit_usd DESC),
    jsonb_build_object(
      'totalClientes', count(*),
      'revenue', COALESCE(sum(c.venta_usd), 0),
      'profit', COALESCE(sum(c.profit_usd), 0),
      'margenProm',
        CASE WHEN COALESCE(sum(c.venta_usd),0) > 0
             THEN ((sum(c.venta_usd) - sum(c.costo_usd)) / sum(c.venta_usd)) * 100
             ELSE 0
        END,
      'embarquesSinTc', COALESCE(sum(c.embarques_sin_tc), 0)
    )
  INTO v_rows, v_kpis
  FROM calc c;

  RETURN jsonb_build_object(
    'clientes', COALESCE(v_rows, '[]'::jsonb),
    'kpis', v_kpis
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reportes_resumen(date,date,text) TO authenticated;