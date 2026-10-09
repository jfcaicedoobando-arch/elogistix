CREATE OR REPLACE FUNCTION public.calcular_costo_demoras(
  p_naviera_condicion_id uuid,
  p_tipo_contenedor_id uuid,
  p_dias_excedidos integer
) RETURNS TABLE (total numeric, moneda text, desglose jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_total numeric := 0;
  v_moneda text := 'USD';
  v_desglose jsonb := '[]'::jsonb;
  v_dias_en_tramo integer;
  v_top integer;
  v_monedas integer;
BEGIN
  IF p_dias_excedidos IS NULL OR p_dias_excedidos < 1 THEN
    RETURN QUERY SELECT 0::numeric, v_moneda, v_desglose;
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT t.moneda) INTO v_monedas
  FROM public.costeo_naviera_demoras_tarifa t
  WHERE t.naviera_condicion_id = p_naviera_condicion_id
    AND t.tipo_contenedor_id = p_tipo_contenedor_id;
  IF v_monedas > 1 THEN
    RAISE EXCEPTION 'LC_DEMORAS_MONEDAS_MIXTAS: el tabulador de este tipo de contenedor mezcla monedas. Usa una sola moneda por tabulador; no hay conversión automática.';
  END IF;

  FOR r IN
    SELECT t.desde_dia, t.hasta_dia, t.monto_por_dia, t.moneda
    FROM public.costeo_naviera_demoras_tarifa t
    WHERE naviera_condicion_id = p_naviera_condicion_id
      AND tipo_contenedor_id = p_tipo_contenedor_id
      AND desde_dia <= p_dias_excedidos
    ORDER BY desde_dia
  LOOP
    v_top := LEAST(COALESCE(r.hasta_dia, p_dias_excedidos), p_dias_excedidos);
    v_dias_en_tramo := v_top - r.desde_dia + 1;
    IF v_dias_en_tramo > 0 THEN
      v_total := v_total + (v_dias_en_tramo * r.monto_por_dia);
      v_moneda := r.moneda;
      v_desglose := v_desglose || jsonb_build_object(
        'desde_dia', r.desde_dia,
        'hasta_dia', v_top,
        'dias', v_dias_en_tramo,
        'monto_por_dia', r.monto_por_dia,
        'subtotal', v_dias_en_tramo * r.monto_por_dia,
        'moneda', r.moneda
      );
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_moneda, v_desglose;
END;
$$;
