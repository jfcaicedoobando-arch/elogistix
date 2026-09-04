CREATE OR REPLACE FUNCTION public.convertir_monto_pago_a_factura(p_monto numeric, p_moneda_pago public.moneda, p_tc_pago numeric, p_moneda_fact public.moneda, p_tc_fact numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_tc numeric;
  v_tc_fact numeric;
  v_mxn numeric;
BEGIN
  IF p_monto IS NULL THEN RETURN NULL; END IF;
  IF p_moneda_pago = p_moneda_fact THEN RETURN p_monto; END IF;
  -- Ruta histórica MXN<->USD: idéntica (usa el TC del pago).
  IF (p_moneda_pago = 'MXN' AND p_moneda_fact = 'USD')
     OR (p_moneda_pago = 'USD' AND p_moneda_fact = 'MXN') THEN
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    IF v_tc <= 1 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_NO_VERIFICABLE: el tipo de cambio del pago (%) no es verificable; se esperan pesos por 1 unidad de divisa (%->%).',
        v_tc, p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    IF p_moneda_pago = 'MXN' THEN RETURN round(p_monto / v_tc, 4);
    ELSE                          RETURN round(p_monto * v_tc, 4);
    END IF;
  END IF;
  -- M-2: cruces con EUR (EUR<->MXN, EUR<->USD) pivotean en MXN.
  IF p_moneda_pago = 'MXN' THEN
    v_mxn := p_monto;
  ELSE
    v_tc := NULLIF(p_tc_pago, 0);
    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: capture el tipo de cambio del pago (%->%)',
        p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    IF v_tc <= 1 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_NO_VERIFICABLE: el tipo de cambio del pago (%) no es verificable; se esperan pesos por 1 unidad de divisa (%->%).',
        v_tc, p_moneda_pago, p_moneda_fact USING ERRCODE = '22023';
    END IF;
    v_mxn := p_monto * v_tc;
  END IF;
  IF p_moneda_fact = 'MXN' THEN RETURN round(v_mxn, 4); END IF;
  v_tc_fact := NULLIF(p_tc_fact, 0);
  IF v_tc_fact IS NULL OR v_tc_fact <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_TC_FACTURA_REQUERIDO: la factura en % necesita tipo de cambio para recibir un pago en %.',
      p_moneda_fact, p_moneda_pago USING ERRCODE = '22023';
  END IF;
  IF v_tc_fact <= 1 THEN
    RAISE EXCEPTION 'LC_PAGO_TC_FACTURA_NO_VERIFICABLE: el tipo de cambio de la factura en % (%) no es verificable; se esperan pesos por 1 unidad de divisa.',
      p_moneda_fact, v_tc_fact USING ERRCODE = '22023';
  END IF;
  RETURN round(v_mxn / v_tc_fact, 4);
END;
$function$;

REVOKE ALL ON FUNCTION public.convertir_monto_pago_a_factura(numeric, public.moneda, numeric, public.moneda, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_monto_pago_a_factura(numeric, public.moneda, numeric, public.moneda, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convertir_monto_pago_a_factura(numeric, public.moneda, numeric, public.moneda, numeric) TO service_role;