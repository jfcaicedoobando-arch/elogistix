CREATE OR REPLACE FUNCTION public.crear_proforma_atomica(p_organization_id uuid, p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_concepto_ids uuid[], p_subtotal_usd numeric, p_iva_usd numeric, p_total_usd numeric, p_subtotal_mxn numeric, p_iva_mxn numeric, p_total_mxn numeric, p_notas text, p_operador text, p_dias_credito integer, p_tasa_iva numeric, p_iva_overrides jsonb DEFAULT '{}'::jsonb)
 RETURNS proformas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero text;
  v_proforma public.proformas;
  v_override record;
  v_org uuid;
  v_sub_usd numeric := 0;
  v_iva_usd numeric := 0;
  v_sub_mxn numeric := 0;
  v_iva_mxn numeric := 0;
  v_tc numeric;
  v_ocupados int;
  v_actualizados int;
  v_ajenos int;
  v_no_soportados int;
  v_overrides_fuera int;
  -- R170-02: fecha de negocio en hora México, no CURRENT_DATE (UTC).
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF p_concepto_ids IS NULL OR array_length(p_concepto_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe seleccionar al menos un concepto';
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;
  PERFORM public._assert_writer(v_org);

  -- Ola E1 · C5: el embarque debe existir en la organización y coincidir con
  -- el cliente recibido; antes se confiaba en los argumentos del cliente.
  IF NOT EXISTS (
    SELECT 1 FROM public.embarques e
     WHERE e.id = p_embarque_id
       AND e.organization_id = v_org
       AND e.deleted_at IS NULL
       AND (p_cliente_id IS NULL OR e.cliente_id = p_cliente_id)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_EMBARQUE_INVALIDO: el embarque no existe en tu organización o no corresponde al cliente indicado'
      USING ERRCODE = 'P0001';
  END IF;

  -- Bloquea los conceptos y valida que estén libres antes de crear la proforma.
  PERFORM 1 FROM public.conceptos_venta
   WHERE id = ANY(p_concepto_ids) AND organization_id = v_org
   FOR UPDATE;

  -- Ola E1 · C5: ningún concepto puede venir de otro embarque ni estar borrado.
  SELECT COUNT(*) INTO v_ajenos
  FROM unnest(p_concepto_ids) AS s(id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.conceptos_venta cv
     WHERE cv.id = s.id
       AND cv.organization_id = v_org
       AND cv.embarque_id = p_embarque_id
       AND cv.deleted_at IS NULL
  );

  IF v_ajenos > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_AJENOS: % concepto(s) no pertenecen a este embarque o fueron eliminados; recarga la pantalla', v_ajenos
      USING ERRCODE = 'P0001';
  END IF;

  -- Ola 2 · A: EUR (o cualquier moneda fuera de MXN/USD) no es soportado en
  -- venta; antes se proformaba y facturaba en $0 en silencio.
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND moneda NOT IN ('MXN', 'USD');

  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_ocupados
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND (proforma_id IS NOT NULL OR COALESCE(estado_facturacion, 'pendiente') <> 'pendiente');

  IF v_ocupados > 0 THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: % concepto(s) ya están en otra proforma o facturados; recarga la pantalla', v_ocupados
      USING ERRCODE = 'P0001';
  END IF;

  IF p_iva_overrides IS NOT NULL AND p_iva_overrides <> '{}'::jsonb THEN
    -- Integridad: un override sólo puede tocar conceptos de ESTA selección.
    -- Antes, el UPDATE no filtraba por p_concepto_ids y podía cambiar
    -- aplica_iva de cualquier otro concepto del mismo embarque.
    SELECT COUNT(*) INTO v_overrides_fuera
    FROM jsonb_object_keys(p_iva_overrides) AS k(id)
    WHERE NOT (k.id::uuid = ANY(p_concepto_ids));

    IF v_overrides_fuera > 0 THEN
      RAISE EXCEPTION 'LC_OVERRIDE_FUERA_DE_SELECCION: % ajuste(s) de IVA apuntan a conceptos que no están en esta proforma; recarga la pantalla', v_overrides_fuera
        USING ERRCODE = 'P0001';
    END IF;

    FOR v_override IN
      SELECT key AS concepto_id, (value)::text::boolean AS aplica
      FROM jsonb_each(p_iva_overrides)
    LOOP
      UPDATE public.conceptos_venta
      SET aplica_iva = v_override.aplica
      WHERE id = v_override.concepto_id::uuid
        AND organization_id = v_org
        AND embarque_id = p_embarque_id
        AND id = ANY(p_concepto_ids);
    END LOOP;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN moneda='USD' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='USD' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' THEN cantidad*precio_unitario ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN moneda='MXN' AND aplica_iva
                      THEN cantidad*precio_unitario*COALESCE(tasa_iva_aplicada, p_tasa_iva)
                      ELSE 0 END), 0)
  INTO v_sub_usd, v_iva_usd, v_sub_mxn, v_iva_mxn
  FROM public.conceptos_venta
  WHERE id = ANY(p_concepto_ids) AND organization_id = v_org;

  IF v_sub_usd > 0 THEN
    SELECT tipo_cambio_usd INTO v_tc
    FROM public.embarques
    WHERE id = p_embarque_id AND organization_id = v_org;

    IF v_tc IS NULL OR v_tc <= 0 THEN
      RAISE EXCEPTION 'LC_PROFORMA_TC_REQUERIDO: el embarque no tiene tipo de cambio USD para convertir los conceptos en dólares'
        USING ERRCODE='P0001';
    END IF;

    v_sub_mxn := v_sub_mxn + round(v_sub_usd * v_tc, 2);
    v_iva_mxn := v_iva_mxn + round(v_iva_usd * v_tc, 2);
  END IF;

  IF ABS(COALESCE(p_iva_usd,0) - v_iva_usd) > 0.01
     OR ABS(COALESCE(p_iva_mxn,0) - v_iva_mxn) > 0.01 THEN
    RAISE NOTICE 'crear_proforma_atomica: desfase cliente vs server';
  END IF;

  v_numero := public.generar_numero_proforma(v_org);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id, tasa_iva_aplicada,
    fecha_emision
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_sub_usd, v_iva_usd, v_sub_usd + v_iva_usd,
    v_sub_mxn, v_iva_mxn, v_sub_mxn + v_iva_mxn,
    p_notas, p_operador, p_dias_credito, v_org, p_tasa_iva,
    v_hoy_mx
  )
  RETURNING * INTO v_proforma;

  UPDATE public.conceptos_venta
  SET estado_facturacion = 'en_proforma', proforma_id = v_proforma.id
  WHERE id = ANY(p_concepto_ids)
    AND organization_id = v_org
    AND embarque_id = p_embarque_id
    AND proforma_id IS NULL
    AND COALESCE(estado_facturacion, 'pendiente') = 'pendiente';

  GET DIAGNOSTICS v_actualizados = ROW_COUNT;
  IF v_actualizados <> array_length(p_concepto_ids, 1) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_YA_ASIGNADOS: los conceptos cambiaron de estado durante la operación; recarga la pantalla'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN v_proforma;
END;
$function$;