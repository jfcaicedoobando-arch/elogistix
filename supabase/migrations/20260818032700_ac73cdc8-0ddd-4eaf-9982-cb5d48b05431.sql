-- BUG-11: cotizacion_totales_conceptos lanza excepción para monedas no soportadas (antes EUR/etc. sumaban 0 en silencio). Reemplaza 20260729043948 (inmutable, ya aplicada).

CREATE OR REPLACE FUNCTION public.cotizacion_totales_conceptos(p_conceptos jsonb)
RETURNS TABLE(
  subtotal_usd numeric, iva_usd numeric, total_usd numeric,
  subtotal_mxn numeric, iva_mxn numeric, total_mxn numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_elem   jsonb;
  v_cant   numeric;
  v_precio numeric;
  v_tasa   numeric;
  v_moneda text;
  v_sub    numeric;
  v_iva    numeric;
BEGIN
  subtotal_usd := 0; iva_usd := 0; total_usd := 0;
  subtotal_mxn := 0; iva_mxn := 0; total_mxn := 0;

  IF p_conceptos IS NULL OR jsonb_typeof(p_conceptos) IS NULL THEN
    RETURN NEXT; RETURN;
  END IF;
  IF jsonb_typeof(p_conceptos) <> 'array' THEN
    RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: conceptos_venta debe ser un arreglo jsonb'
      USING ERRCODE = '23514';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_conceptos)
  LOOP
    v_cant   := COALESCE((v_elem ->> 'cantidad')::numeric, 0);
    v_precio := COALESCE((v_elem ->> 'precio_unitario')::numeric, 0);
    v_tasa   := COALESCE(
                  (v_elem ->> 'tasa_iva_aplicada')::numeric,
                  CASE WHEN COALESCE((v_elem ->> 'aplica_iva')::boolean, false) THEN 0.16 ELSE 0 END
                );
    v_moneda := upper(COALESCE(NULLIF(v_elem ->> 'moneda', ''), 'USD'));

    IF v_cant < 0 OR v_precio < 0 OR v_tasa < 0 OR v_tasa > 1 THEN
      RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: cantidad/precio negativos o tasa de IVA fuera de [0,1] en concepto "%"',
        COALESCE(v_elem ->> 'descripcion', '?')
        USING ERRCODE = '23514';
    END IF;

    v_sub := ROUND(v_cant * v_precio, 2);
    v_iva := ROUND(v_sub * v_tasa, 2);

    IF v_moneda = 'USD' THEN
      subtotal_usd := subtotal_usd + v_sub;
      iva_usd      := iva_usd + v_iva;
    ELSIF v_moneda = 'MXN' THEN
      subtotal_mxn := subtotal_mxn + v_sub;
      iva_mxn      := iva_mxn + v_iva;
    ELSE
      -- BUG-11: moneda no soportada — antes el concepto no sumaba ni fallaba
      -- (un concepto EUR quedaba en 0 en silencio y la cotización pasaba).
      RAISE EXCEPTION 'LC_COTIZACION_MONEDA_NO_SOPORTADA: moneda "%" no soportada en concepto "%" (soportadas: USD, MXN)',
        v_moneda, COALESCE(v_elem ->> 'descripcion', '?')
        USING ERRCODE = '23514';
    END IF;
  END LOOP;

  total_usd := subtotal_usd + iva_usd;
  total_mxn := subtotal_mxn + iva_mxn;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cotizacion_totales_conceptos(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotizacion_totales_conceptos(jsonb) TO authenticated, service_role;