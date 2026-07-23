-- Helper privado: calcula monto de costo (naviera) y venta (org) para un contenedor
-- según el número de días excedidos, aplicando el tabulador escalonado.
-- Consumido por public.calcular_demoras_embarque.
CREATE OR REPLACE FUNCTION public._calcular_demoras_montos_contenedor(
  p_cond_id uuid,
  p_org uuid,
  p_tipo_cont_id uuid,
  p_dias_excedidos integer,
  p_moneda_default text
) RETURNS TABLE(monto_costo numeric, moneda_costo text, monto_venta numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  monto_costo := 0;
  monto_venta := 0;
  moneda_costo := COALESCE(p_moneda_default, 'USD');

  IF p_dias_excedidos <= 0 OR p_tipo_cont_id IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_cond_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(
        CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia ELSE 0 END
      ),0),
      COALESCE(MAX(t.moneda), COALESCE(p_moneda_default,'USD'))
    INTO monto_costo, moneda_costo
    FROM generate_series(1, p_dias_excedidos) d
    LEFT JOIN LATERAL (
      SELECT monto_por_dia, moneda, desde_dia, hasta_dia
      FROM public.costeo_naviera_demoras_tarifa
      WHERE naviera_condicion_id = p_cond_id
        AND tipo_contenedor_id = p_tipo_cont_id
        AND d >= desde_dia
        AND (hasta_dia IS NULL OR d <= hasta_dia)
      ORDER BY desde_dia DESC LIMIT 1
    ) t ON true;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN d >= t.desde_dia AND (t.hasta_dia IS NULL OR d <= t.hasta_dia) THEN t.monto_por_dia_usd ELSE 0 END
  ),0)
  INTO monto_venta
  FROM generate_series(1, p_dias_excedidos) d
  LEFT JOIN LATERAL (
    SELECT monto_por_dia_usd, desde_dia, hasta_dia
    FROM public.costeo_demoras_venta_tarifa
    WHERE organization_id = p_org
      AND tipo_contenedor_id = p_tipo_cont_id
      AND (vigente_desde IS NULL OR vigente_desde <= CURRENT_DATE)
      AND (vigente_hasta IS NULL OR vigente_hasta >= CURRENT_DATE)
      AND d >= desde_dia
      AND (hasta_dia IS NULL OR d <= hasta_dia)
    ORDER BY desde_dia DESC LIMIT 1
  ) t ON true;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._calcular_demoras_montos_contenedor(uuid, uuid, uuid, integer, text) FROM PUBLIC;
