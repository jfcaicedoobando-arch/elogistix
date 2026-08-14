CREATE OR REPLACE FUNCTION public.refacturacion_validar_consistencia(p_caso_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_new public.facturas%ROWTYPE;
  v_h jsonb := '[]'::jsonb;
  v_sum_old numeric;
  v_sum_new numeric;
  v_dif int;
  v_pago numeric;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  SELECT * INTO v_old FROM public.facturas WHERE id = v_c.factura_original_id;

  IF v_c.factura_nueva_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'hallazgos', jsonb_build_array(jsonb_build_object(
        'codigo', 'LC_REFACT_SIN_FACTURA_NUEVA',
        'mensaje', 'Todavía no se ha generado la nueva factura.'))
    );
  END IF;

  SELECT * INTO v_new FROM public.facturas WHERE id = v_c.factura_nueva_id;

  -- Receptor
  IF NOT public._rfc_valido(v_new.rfc_cliente, false) THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_RFC_INVALIDO',
      'mensaje', 'El RFC del receptor de la nueva factura no tiene formato válido del SAT.');
  END IF;
  IF v_new.cliente_id IS DISTINCT FROM v_c.cliente_destino_id THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_RECEPTOR_INCOMPLETO',
      'mensaje', 'La nueva factura no está emitida al cliente destino del caso.');
  END IF;

  -- Moneda y tipo de cambio
  IF v_new.moneda <> v_old.moneda THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_MONEDA_INCONSISTENTE',
      'mensaje', format('La factura original está en %s y la nueva en %s.', v_old.moneda, v_new.moneda));
  END IF;
  IF v_new.moneda <> 'MXN' AND COALESCE(v_new.tipo_cambio, 0) <= 0 THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_TC_REQUERIDO',
      'mensaje', 'Falta el tipo de cambio de la nueva factura.');
  END IF;

  -- Importes
  IF ROUND(COALESCE(v_new.subtotal, 0), 2) <> ROUND(COALESCE(v_old.subtotal, 0), 2) THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_TOTAL_INCONSISTENTE',
      'mensaje', 'El subtotal de la nueva factura no coincide con el de la original.');
  END IF;
  IF ROUND(COALESCE(v_new.total, 0), 2) <> ROUND(COALESCE(v_old.total, 0), 2) THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_TOTAL_INCONSISTENTE',
      'mensaje', 'El total de la nueva factura no coincide con el de la original.');
  END IF;
  IF ROUND(COALESCE(v_new.iva, 0), 2) <> ROUND(COALESCE(v_old.iva, 0), 2)
     OR ROUND(COALESCE(v_new.ret_isr, 0), 2) <> ROUND(COALESCE(v_old.ret_isr, 0), 2)
     OR ROUND(COALESCE(v_new.ret_iva, 0), 2) <> ROUND(COALESCE(v_old.ret_iva, 0), 2) THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_IMPUESTOS_INCONSISTENTES',
      'mensaje', 'Los impuestos trasladados o las retenciones no coinciden con la factura original.');
  END IF;

  -- Conceptos: mismas claves SAT y tasas
  SELECT COALESCE(SUM(total), 0) INTO v_sum_old
  FROM public.conceptos_factura WHERE factura_id = v_old.id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(total), 0) INTO v_sum_new
  FROM public.conceptos_factura WHERE factura_id = v_new.id AND deleted_at IS NULL;
  IF ROUND(v_sum_old, 2) <> ROUND(v_sum_new, 2) THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_TOTAL_INCONSISTENTE',
      'mensaje', 'La suma de los conceptos de la nueva factura no coincide con la original.');
  END IF;

  SELECT COUNT(*) INTO v_dif FROM (
    SELECT clave_sat, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva, COUNT(*) AS n
      FROM public.conceptos_factura WHERE factura_id = v_old.id AND deleted_at IS NULL
      GROUP BY 1,2,3,4,5
    EXCEPT
    SELECT clave_sat, tipo_iva, tasa_iva_aplicada, tasa_ret_isr, tasa_ret_iva, COUNT(*) AS n
      FROM public.conceptos_factura WHERE factura_id = v_new.id AND deleted_at IS NULL
      GROUP BY 1,2,3,4,5
  ) d;
  IF v_dif > 0 THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_IMPUESTOS_INCONSISTENTES',
      'mensaje', 'Las claves del SAT o las tasas de impuesto de los conceptos difieren de la factura original.');
  END IF;

  -- Ruta 01: relación de sustitución
  IF v_c.ruta_fiscal = '01' AND v_new.sustituye_a IS DISTINCT FROM v_old.id THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_SUSTITUCION_FALTANTE',
      'mensaje', 'La ruta de sustitución requiere relacionar la nueva factura con el CFDI original.');
  END IF;

  -- Depósito
  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pago
  FROM public.pagos_factura
  WHERE factura_id = v_new.id AND deleted_at IS NULL;
  IF ROUND(v_pago, 2) > ROUND(COALESCE(v_new.total, 0), 2) + 0.01 THEN
    v_h := v_h || jsonb_build_object('codigo', 'LC_REFACT_SOBREPAGO',
      'mensaje', 'El pago aplicado excede el total de la nueva factura.');
  END IF;

  RETURN jsonb_build_object(
    'ok', jsonb_array_length(v_h) = 0,
    'hallazgos', v_h,
    'factura_original', jsonb_build_object('numero', v_old.numero, 'moneda', v_old.moneda,
      'subtotal', v_old.subtotal, 'iva', v_old.iva, 'ret_isr', COALESCE(v_old.ret_isr, 0),
      'ret_iva', COALESCE(v_old.ret_iva, 0), 'total', v_old.total, 'tipo_cambio', v_old.tipo_cambio),
    'factura_nueva', jsonb_build_object('numero', v_new.numero, 'moneda', v_new.moneda,
      'subtotal', v_new.subtotal, 'iva', v_new.iva, 'ret_isr', COALESCE(v_new.ret_isr, 0),
      'ret_iva', COALESCE(v_new.ret_iva, 0), 'total', v_new.total, 'tipo_cambio', v_new.tipo_cambio),
    'pago_aplicado', v_pago
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturacion_validar_consistencia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refacturacion_validar_consistencia(uuid) TO authenticated, service_role;

-- 6) Reasignar pago: ordenante obligatorio y RFC validado.
