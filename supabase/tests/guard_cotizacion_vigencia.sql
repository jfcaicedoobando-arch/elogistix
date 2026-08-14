-- Ola 18 · `fecha_vigencia` debe seguir a `validez_propuesta`.
-- Bug de origen: al crear la cotización sin validez propuesta se guardaba
-- emisión + 15 días; al capturar después la validez (p. ej. 21/08) el UPDATE
-- no recalculaba `fecha_vigencia` y el detalle/PDF seguían mostrando 29/08.
DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_cot uuid;
  v_vig date;
  v_dias int;
  v_hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST VIGENCIA COT', 'TVC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE VIGENCIA', 'XAXX010101000', 'vigencia-cot@test.local')
  RETURNING id INTO v_cli;

  -- 1) Alta sin validez propuesta ⇒ default de 15 días desde hoy (CDMX).
  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo)
  VALUES (v_org, v_cli, 'Borrador'::public.estado_cotizacion, 'COT-VIG-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_cot;

  SELECT fecha_vigencia, vigencia_dias INTO v_vig, v_dias
  FROM public.cotizaciones WHERE id = v_cot;
  IF v_vig <> v_hoy + 15 OR v_dias <> 15 THEN
    RAISE EXCEPTION 'OLA18 FAIL: default de vigencia incorrecto (fecha=%, dias=%)', v_vig, v_dias;
  END IF;

  -- 2) Capturar validez propuesta ⇒ la vigencia se alinea y los días se derivan.
  UPDATE public.cotizaciones
  SET validez_propuesta = v_hoy + 7
  WHERE id = v_cot;

  SELECT fecha_vigencia, vigencia_dias INTO v_vig, v_dias
  FROM public.cotizaciones WHERE id = v_cot;
  IF v_vig <> v_hoy + 7 THEN
    RAISE EXCEPTION 'OLA18 FAIL: fecha_vigencia no siguió a validez_propuesta (fecha=%)', v_vig;
  END IF;
  IF v_dias <> 7 THEN
    RAISE EXCEPTION 'OLA18 FAIL: vigencia_dias esperado 7, obtenido %', v_dias;
  END IF;

  -- 3) Intentar forzar otra fecha de vigencia con validez capturada: gana la validez.
  UPDATE public.cotizaciones SET fecha_vigencia = v_hoy + 30 WHERE id = v_cot;
  SELECT fecha_vigencia INTO v_vig FROM public.cotizaciones WHERE id = v_cot;
  IF v_vig <> v_hoy + 7 THEN
    RAISE EXCEPTION 'OLA18 FAIL: fecha_vigencia divergió de validez_propuesta (fecha=%)', v_vig;
  END IF;

  -- 4) Alta con validez propuesta desde el INSERT.
  INSERT INTO public.cotizaciones (organization_id, cliente_id, estado, folio, modo, tipo, validez_propuesta)
  VALUES (v_org, v_cli, 'Borrador'::public.estado_cotizacion, 'COT-VIG-0002',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, v_hoy + 3)
  RETURNING id INTO v_cot;
  SELECT fecha_vigencia, vigencia_dias INTO v_vig, v_dias FROM public.cotizaciones WHERE id = v_cot;
  IF v_vig <> v_hoy + 3 OR v_dias <> 3 THEN
    RAISE EXCEPTION 'OLA18 FAIL: INSERT con validez (fecha=%, dias=%)', v_vig, v_dias;
  END IF;

  RAISE NOTICE 'OLA18 OK: vigencia de cotización sincronizada con validez propuesta';
  RAISE EXCEPTION 'ROLLBACK_TEST_OK';
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TEST_OK' THEN
      RAISE NOTICE 'guard_cotizacion_vigencia: PASS';
    ELSE
      RAISE;
    END IF;
END $$;
