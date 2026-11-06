-- Forward-only: a same-currency ratio does not require an exchange rate.
-- Preserve existing owner/ACL (including any existing service_role grant).
CREATE OR REPLACE FUNCTION public._cotizacion_margen_pct(p_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp AS $$
DECLARE
  c record; r record; v_tc numeric;
  v_venta numeric := 0; v_costo numeric := 0;
  v_has_mxn boolean := false; v_has_other boolean := false;
BEGIN
  SELECT conceptos_venta, tipo_cambio_usd INTO c FROM public.cotizaciones WHERE id = p_id;
  v_tc := NULLIF(c.tipo_cambio_usd, 0);
  FOR r IN SELECT coalesce(e->>'moneda', 'USD') AS moneda,
                  coalesce((e->>'cantidad')::numeric, 0) * coalesce((e->>'precio_unitario')::numeric, 0) AS monto
           FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.conceptos_venta) = 'array' THEN c.conceptos_venta ELSE '[]'::jsonb END) e
  LOOP
    IF r.moneda = 'MXN' THEN
      v_has_mxn := v_has_mxn OR r.monto <> 0;
    ELSE
      -- Preserve the established non-MXN/default-USD interpretation.
      v_has_other := v_has_other OR r.monto <> 0;
    END IF;
  END LOOP;
  FOR r IN SELECT moneda, coalesce(costo_total, 0) AS monto
           FROM public.cotizacion_costos WHERE cotizacion_id = p_id AND deleted_at IS NULL
  LOOP
    IF r.moneda = 'MXN' THEN
      v_has_mxn := v_has_mxn OR r.monto <> 0;
    ELSE
      v_has_other := v_has_other OR r.monto <> 0;
    END IF;
  END LOOP;
  -- Classify before arithmetic: neither an unnecessary FX division in a
  -- homogeneous quote nor an unnecessary raw subtotal in a mixed quote.
  IF v_has_mxn AND v_has_other AND v_tc IS NULL THEN RETURN NULL; END IF;
  -- Preserve historical per-line conversion/order only for effective mixtures.
    FOR r IN SELECT coalesce(e->>'moneda', 'USD') AS moneda,
                    coalesce((e->>'cantidad')::numeric, 0) * coalesce((e->>'precio_unitario')::numeric, 0) AS monto
             FROM jsonb_array_elements(CASE WHEN jsonb_typeof(c.conceptos_venta) = 'array' THEN c.conceptos_venta ELSE '[]'::jsonb END) e
    LOOP
      IF v_has_mxn AND v_has_other AND r.moneda = 'MXN' THEN v_venta := v_venta + r.monto / v_tc;
      ELSE v_venta := v_venta + r.monto; END IF;
    END LOOP;
    FOR r IN SELECT moneda, coalesce(costo_total, 0) AS monto
             FROM public.cotizacion_costos WHERE cotizacion_id = p_id AND deleted_at IS NULL
    LOOP
      IF v_has_mxn AND v_has_other AND r.moneda = 'MXN' THEN v_costo := v_costo + r.monto / v_tc;
      ELSE v_costo := v_costo + r.monto; END IF;
    END LOOP;
  IF v_venta <= 0 THEN RETURN NULL; END IF;
  RETURN round((v_venta - v_costo) / v_venta * 100, 2);
END $$;
