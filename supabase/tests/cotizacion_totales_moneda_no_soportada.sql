-- BUG-11: public.cotizacion_totales_conceptos(jsonb) rechaza monedas no
-- soportadas (antes un concepto EUR sumaba 0 en silencio) y sigue validando
-- cantidad/precio negativos y tasa de IVA fuera de rango.
DO $$
DECLARE
  v_res record;
  v_sqlstate text;
  v_msg text;
  v_atrapado boolean;
BEGIN
  -- Caso 1: concepto en EUR -> LC_COTIZACION_MONEDA_NO_SOPORTADA
  v_atrapado := false;
  BEGIN
    PERFORM * FROM public.cotizacion_totales_conceptos(
      '[{"descripcion":"Flete","cantidad":1,"precio_unitario":100,"moneda":"EUR"}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    v_sqlstate := SQLSTATE; v_msg := SQLERRM;
    IF v_msg LIKE 'LC_COTIZACION_MONEDA_NO_SOPORTADA%' THEN
      v_atrapado := true;
    ELSE
      RAISE;
    END IF;
  END;
  IF NOT v_atrapado THEN
    RAISE EXCEPTION 'FAIL CASO1: se esperaba LC_COTIZACION_MONEDA_NO_SOPORTADA para EUR';
  END IF;
  RAISE NOTICE '✓ CASO 1: moneda EUR rechazada';

  -- Caso 2: USD y MXN suman correctamente en columnas separadas
  SELECT * INTO v_res FROM public.cotizacion_totales_conceptos(
    '[
      {"descripcion":"Flete USD","cantidad":2,"precio_unitario":50,"moneda":"USD","aplica_iva":true},
      {"descripcion":"Maniobra MXN","cantidad":3,"precio_unitario":100,"moneda":"MXN","aplica_iva":false}
    ]'::jsonb
  );
  IF v_res.subtotal_usd <> 100 OR v_res.iva_usd <> 16 OR v_res.total_usd <> 116 THEN
    RAISE EXCEPTION 'FAIL CASO2: USD incorrecto (subtotal=%, iva=%, total=%)',
      v_res.subtotal_usd, v_res.iva_usd, v_res.total_usd;
  END IF;
  IF v_res.subtotal_mxn <> 300 OR v_res.iva_mxn <> 0 OR v_res.total_mxn <> 300 THEN
    RAISE EXCEPTION 'FAIL CASO2: MXN incorrecto (subtotal=%, iva=%, total=%)',
      v_res.subtotal_mxn, v_res.iva_mxn, v_res.total_mxn;
  END IF;
  RAISE NOTICE '✓ CASO 2: USD y MXN suman correctamente (USD total=%, MXN total=%)',
    v_res.total_usd, v_res.total_mxn;

  -- Caso 3: cantidad negativa -> LC_COTIZACION_CONCEPTO_INVALIDO
  v_atrapado := false;
  BEGIN
    PERFORM * FROM public.cotizacion_totales_conceptos(
      '[{"descripcion":"Malo","cantidad":-1,"precio_unitario":10,"moneda":"USD"}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'LC_COTIZACION_CONCEPTO_INVALIDO%' THEN v_atrapado := true; ELSE RAISE; END IF;
  END;
  IF NOT v_atrapado THEN
    RAISE EXCEPTION 'FAIL CASO3: se esperaba LC_COTIZACION_CONCEPTO_INVALIDO con cantidad negativa';
  END IF;
  RAISE NOTICE '✓ CASO 3: cantidad negativa rechazada';

  -- Caso 4: tasa_iva_aplicada > 1 -> LC_COTIZACION_CONCEPTO_INVALIDO
  v_atrapado := false;
  BEGIN
    PERFORM * FROM public.cotizacion_totales_conceptos(
      '[{"descripcion":"Malo","cantidad":1,"precio_unitario":10,"moneda":"USD","tasa_iva_aplicada":1.5}]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'LC_COTIZACION_CONCEPTO_INVALIDO%' THEN v_atrapado := true; ELSE RAISE; END IF;
  END;
  IF NOT v_atrapado THEN
    RAISE EXCEPTION 'FAIL CASO4: se esperaba LC_COTIZACION_CONCEPTO_INVALIDO con tasa_iva_aplicada>1';
  END IF;
  RAISE NOTICE '✓ CASO 4: tasa de IVA fuera de rango rechazada';

  -- Caso 5: jsonb no es un arreglo -> LC_COTIZACION_CONCEPTO_INVALIDO
  v_atrapado := false;
  BEGIN
    PERFORM * FROM public.cotizacion_totales_conceptos('{"descripcion":"no es arreglo"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'LC_COTIZACION_CONCEPTO_INVALIDO%' THEN v_atrapado := true; ELSE RAISE; END IF;
  END;
  IF NOT v_atrapado THEN
    RAISE EXCEPTION 'FAIL CASO5: se esperaba LC_COTIZACION_CONCEPTO_INVALIDO con jsonb no-arreglo';
  END IF;
  RAISE NOTICE '✓ CASO 5: jsonb no-arreglo rechazado';

  RAISE NOTICE 'cotizacion_totales_moneda_no_soportada: PASS';
END $$;
