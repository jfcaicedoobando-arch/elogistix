CREATE OR REPLACE FUNCTION public.reasignar_pago_factura(
  p_pago_id uuid,
  p_factura_destino_id uuid,
  p_caso_id uuid DEFAULT NULL,
  p_ordenante_nombre text DEFAULT NULL,
  p_ordenante_rfc text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_p public.pagos_factura%ROWTYPE;
  v_dest public.facturas%ROWTYPE;
  v_new_id uuid;
  v_saldo numeric;
  v_pagado numeric;
  v_ncs numeric;
  v_ord_nombre text := NULLIF(btrim(COALESCE(p_ordenante_nombre, '')), '');
  v_ord_rfc text := NULLIF(upper(btrim(COALESCE(p_ordenante_rfc, ''))), '');
BEGIN
  SELECT * INTO v_p FROM public.pagos_factura WHERE id = p_pago_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_PAGO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_p.organization_id);

  IF v_p.uuid_rep IS NOT NULL AND v_p.rep_cancelado_en IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_REP_VIVO: cancela el complemento de pago (REP) antes de reasignar el pago'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_ord_nombre IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_ORDENANTE_REQUERIDO: captura el nombre de la empresa que realizó el depósito'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_ord_rfc IS NOT NULL AND NOT public._rfc_valido(v_ord_rfc, true) THEN
    RAISE EXCEPTION 'LC_REFACT_RFC_INVALIDO: el RFC del ordenante (%) no tiene formato válido del SAT', v_ord_rfc
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_dest FROM public.facturas WHERE id = p_factura_destino_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  IF v_dest.organization_id <> v_p.organization_id THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_OTRA_ORG' USING ERRCODE = '42501';
  END IF;
  IF v_dest.uuid_fiscal IS NULL OR v_dest.estado IN ('Borrador','Cancelada','Sustituida') THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_TIMBRADA: la factura destino debe estar timbrada y vigente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_dest.moneda <> v_p.moneda THEN
    RAISE EXCEPTION 'LC_REFACT_MONEDA_INCONSISTENTE: el pago está en % y la factura destino en %', v_p.moneda, v_dest.moneda
      USING ERRCODE = 'P0001';
  END IF;
  IF v_dest.moneda <> 'MXN' AND COALESCE(v_p.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_REFACT_TC_REQUERIDO: el pago en % requiere tipo de cambio', v_dest.moneda
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM public.pagos_factura
  WHERE factura_id = p_factura_destino_id AND deleted_at IS NULL;
  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_destino_id AND deleted_at IS NULL AND estado = 'Aplicada';
  v_saldo := COALESCE(v_dest.total, 0) - v_pagado - v_ncs;

  IF ROUND(v_p.monto_aplicado_factura, 2) > ROUND(v_saldo, 2) + 0.01 THEN
    RAISE EXCEPTION 'LC_REFACT_SOBREPAGO: el pago (%) excede el saldo de la factura destino (%)',
      v_p.monto_aplicado_factura, v_saldo USING ERRCODE = 'P0001';
  END IF;

  -- 1) Baja lógica del pago original.
  UPDATE public.pagos_factura
     SET deleted_at = now(), deleted_by = auth.uid(),
         notas = COALESCE(notas, '') || ' [Reasignado a factura ' || COALESCE(v_dest.numero, '') || ']',
         refacturacion_id = COALESCE(p_caso_id, refacturacion_id)
   WHERE id = p_pago_id;

  -- 2) Alta del pago equivalente en la factura destino.
  INSERT INTO public.pagos_factura (
    factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, referencia, notas,
    diferencia_cambiaria_mxn, embarque_id, cuenta_bancaria_id, created_by,
    ordenante_distinto, ordenante_nombre, ordenante_rfc, refacturacion_id
  ) VALUES (
    p_factura_destino_id, v_p.organization_id, v_p.fecha_pago, v_p.monto, v_p.moneda, v_p.tipo_cambio,
    v_p.monto_aplicado_factura, v_p.forma_pago, v_p.referencia,
    COALESCE(v_p.notas, '') || ' [Reasignado desde pago ' || p_pago_id::text || ']',
    COALESCE(v_p.diferencia_cambiaria_mxn, 0), v_dest.embarque_id, v_p.cuenta_bancaria_id, auth.uid(),
    true, v_ord_nombre, v_ord_rfc, p_caso_id
  )
  RETURNING id INTO v_new_id;

  -- 3) Traslado del movimiento bancario.
  UPDATE public.bbva_movimientos
     SET pago_factura_id = v_new_id,
         estado_conciliacion = 'Conciliado',
         conciliado_por = auth.uid(),
         conciliado_at = now()
   WHERE pago_factura_id = p_pago_id;

  IF p_caso_id IS NOT NULL THEN
    UPDATE public.refacturaciones
       SET pago_original_id = COALESCE(pago_original_id, p_pago_id),
           pago_nuevo_id = v_new_id,
           paso_actual = 5
     WHERE id = p_caso_id;
  END IF;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_p.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_pago_reasignado', 'facturacion', p_factura_destino_id,
    COALESCE(v_dest.numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'pago_original_id', p_pago_id,
                       'pago_nuevo_id', v_new_id, 'monto', v_p.monto, 'moneda', v_p.moneda,
                       'ordenante_nombre', v_ord_nombre)
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reasignar_pago_factura(uuid, uuid, uuid, text, text) TO authenticated, service_role;

-- 7) Cierre del caso: exige consistencia final.
