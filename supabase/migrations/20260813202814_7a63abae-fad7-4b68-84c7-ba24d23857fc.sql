-- Ola 12 · Refacturación — refuerzo de validaciones fiscales

-- 1) Helper de RFC (formato SAT). No acepta genéricos para refacturación nominativa.
CREATE OR REPLACE FUNCTION public._rfc_valido(p_rfc text, p_permitir_generico boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $function$
DECLARE
  v text := upper(btrim(COALESCE(p_rfc, '')));
BEGIN
  IF v = '' THEN
    RETURN false;
  END IF;
  IF NOT p_permitir_generico AND v IN ('XAXX010101000', 'XEXX010101000') THEN
    RETURN false;
  END IF;
  RETURN v ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$';
END;
$function$;

REVOKE ALL ON FUNCTION public._rfc_valido(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._rfc_valido(text, boolean) TO authenticated, service_role;

-- 2) Receptor fiscalmente completo (CFDI 4.0).
CREATE OR REPLACE FUNCTION public._assert_receptor_fiscal_valido(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v public.clientes%ROWTYPE;
  v_faltantes text[] := ARRAY[]::text[];
  v_cp text;
BEGIN
  SELECT * INTO v FROM public.clientes WHERE id = p_cliente_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe' USING ERRCODE = 'P0002';
  END IF;

  IF btrim(COALESCE(v.nombre, '')) = '' THEN
    v_faltantes := v_faltantes || 'razón social';
  END IF;
  IF NOT public._rfc_valido(v.rfc, false) THEN
    RAISE EXCEPTION 'LC_REFACT_RFC_INVALIDO: el RFC del receptor (%) no tiene formato válido del SAT o es genérico',
      COALESCE(v.rfc, '(vacío)') USING ERRCODE = 'P0001';
  END IF;
  IF btrim(COALESCE(v.regimen_fiscal, '')) = '' THEN
    v_faltantes := v_faltantes || 'régimen fiscal';
  END IF;
  v_cp := btrim(COALESCE(NULLIF(btrim(COALESCE(v.codigo_postal, '')), ''), COALESCE(v.cp, '')));
  IF v_cp !~ '^[0-9]{5}$' THEN
    v_faltantes := v_faltantes || 'código postal (5 dígitos)';
  END IF;

  IF array_length(v_faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'LC_REFACT_RECEPTOR_INCOMPLETO: faltan datos fiscales del receptor: %',
      array_to_string(v_faltantes, ', ') USING ERRCODE = 'P0001';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_receptor_fiscal_valido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_receptor_fiscal_valido(uuid) TO authenticated, service_role;

-- 3) Abrir caso: exige receptor fiscalmente completo.
CREATE OR REPLACE FUNCTION public.abrir_caso_refacturacion(
  p_factura_id uuid,
  p_cliente_destino_id uuid,
  p_ruta_fiscal text DEFAULT '02',
  p_motivo text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_f public.facturas%ROWTYPE;
  v_dest_org uuid;
  v_id uuid;
BEGIN
  IF p_ruta_fiscal NOT IN ('01','02') THEN
    RAISE EXCEPTION 'LC_REFACT_RUTA: ruta fiscal inválida (01 o 02)' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_f.organization_id);

  IF v_f.uuid_fiscal IS NULL THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_TIMBRADA: la factura original no está timbrada'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_f.estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_VIVA: la factura está en estado %', v_f.estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT organization_id INTO v_dest_org
  FROM public.clientes WHERE id = p_cliente_destino_id AND deleted_at IS NULL;
  IF v_dest_org IS NULL OR v_dest_org <> v_f.organization_id THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe en esta organización'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_cliente_destino_id = v_f.cliente_id THEN
    RAISE EXCEPTION 'LC_REFACT_MISMO_CLIENTE: el cliente destino es el mismo de la factura'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._assert_receptor_fiscal_valido(p_cliente_destino_id);

  IF EXISTS (
    SELECT 1 FROM public.refacturaciones
    WHERE factura_original_id = p_factura_id AND estado = 'abierto'
  ) THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_ABIERTO: ya existe un caso de refacturación abierto para esta factura'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.refacturaciones (
    organization_id, factura_original_id, cliente_origen_id, cliente_destino_id,
    ruta_fiscal, motivo, embarque_id, pago_original_id, created_by
  ) VALUES (
    v_f.organization_id, p_factura_id, v_f.cliente_id, p_cliente_destino_id,
    p_ruta_fiscal, COALESCE(p_motivo, ''), v_f.embarque_id,
    (SELECT id FROM public.pagos_factura
      WHERE factura_id = p_factura_id AND deleted_at IS NULL
      ORDER BY fecha_pago DESC, created_at DESC LIMIT 1),
    auth.uid()
  )
  RETURNING id INTO v_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_f.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_abierta', 'facturacion', p_factura_id, COALESCE(v_f.numero, ''),
    jsonb_build_object('caso_id', v_id, 'ruta_fiscal', p_ruta_fiscal,
                       'cliente_destino_id', p_cliente_destino_id, 'motivo', COALESCE(p_motivo, ''))
  );

  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.abrir_caso_refacturacion(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abrir_caso_refacturacion(uuid, uuid, text, text) TO authenticated, service_role;

-- 4) Duplicado: valida receptor y copia también retenciones.
CREATE OR REPLACE FUNCTION public.duplicar_factura_para_refacturacion(p_caso_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_cli public.clientes%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
  v_estado_nueva text;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  IF v_c.factura_nueva_id IS NOT NULL THEN
    SELECT estado::text INTO v_estado_nueva FROM public.facturas WHERE id = v_c.factura_nueva_id;
    IF v_estado_nueva IS NOT NULL AND v_estado_nueva <> 'Cancelada' THEN
      RETURN v_c.factura_nueva_id;
    END IF;
  END IF;

  SELECT * INTO v_old FROM public.facturas WHERE id = v_c.factura_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cli FROM public.clientes WHERE id = v_c.cliente_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_receptor_fiscal_valido(v_c.cliente_destino_id);

  IF v_old.moneda <> 'MXN' AND COALESCE(v_old.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_REFACT_TC_REQUERIDO: la factura original en % no tiene tipo de cambio', v_old.moneda
      USING ERRCODE = 'P0001';
  END IF;

  v_new_numero := v_old.numero || '-RF';
  WHILE EXISTS (
    SELECT 1 FROM public.facturas
    WHERE organization_id = v_old.organization_id AND numero = v_new_numero
  ) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, ret_isr, ret_iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl, snapshot_emision, estado, origen, sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_cli.id, v_cli.nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, v_old.proforma_id,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE,
    CURRENT_DATE + COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    v_old.moneda, v_old.tipo_cambio, v_old.subtotal, v_old.iva,
    COALESCE(v_old.ret_isr, 0), COALESCE(v_old.ret_iva, 0), v_old.total,
    COALESCE(v_cli.metodo_pago_default, v_old.metodo_pago),
    COALESCE(v_cli.forma_pago_default, v_old.forma_pago),
    COALESCE(v_cli.uso_cfdi_default, v_old.uso_cfdi),
    v_cli.rfc,
    COALESCE(v_old.notas, '') || E'\n[Refacturación de ' || v_old.numero || ' a ' || v_cli.nombre || ']',
    v_old.referencia_bl, NULL, 'Borrador', v_old.origen,
    CASE WHEN v_c.ruta_fiscal = '01' THEN v_old.id ELSE NULL END
  );

  IF v_c.ruta_fiscal = '01' THEN
    UPDATE public.facturas SET sustituida_por = v_new_id WHERE id = v_old.id;
  END IF;

  INSERT INTO public.conceptos_factura (
    factura_id, organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  )
  SELECT
    v_new_id, v_old.organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  FROM public.conceptos_factura
  WHERE factura_id = v_old.id AND deleted_at IS NULL;

  INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
  SELECT v_new_id, embarque_id, organization_id, true
  FROM public.factura_embarques
  WHERE factura_id = v_old.id
  ON CONFLICT DO NOTHING;

  UPDATE public.refacturaciones
     SET factura_nueva_id = v_new_id, paso_actual = GREATEST(paso_actual, 3)
   WHERE id = p_caso_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_borrador_creado', 'facturacion', v_new_id, COALESCE(v_new_numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'factura_original_id', v_old.id,
                       'cliente_destino_id', v_cli.id, 'rfc_destino', v_cli.rfc,
                       'ruta_fiscal', v_c.ruta_fiscal)
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) TO authenticated, service_role;

-- 5) Verificación de consistencia del caso (original vs. nueva vs. depósito).
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
CREATE OR REPLACE FUNCTION public.cerrar_caso_refacturacion(p_caso_id uuid, p_cancelar boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_val jsonb;
  v_estado_nueva text;
  v_uuid_nueva text;
  v_pago_ok boolean;
  v_mov_pendiente int;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  IF NOT p_cancelar THEN
    IF v_c.factura_nueva_id IS NULL THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: falta generar y timbrar la nueva factura'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT estado::text, uuid_fiscal INTO v_estado_nueva, v_uuid_nueva
    FROM public.facturas WHERE id = v_c.factura_nueva_id;
    IF v_uuid_nueva IS NULL OR v_estado_nueva IN ('Borrador','Cancelada','Sustituida') THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: la nueva factura debe estar timbrada y vigente'
        USING ERRCODE = 'P0001';
    END IF;

    v_val := public.refacturacion_validar_consistencia(p_caso_id);
    IF NOT (v_val->>'ok')::boolean THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: %',
        COALESCE((v_val->'hallazgos'->0->>'mensaje'), 'la nueva factura no es consistente con la original')
        USING ERRCODE = 'P0001';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.pagos_factura
      WHERE factura_id = v_c.factura_nueva_id AND deleted_at IS NULL
    ) INTO v_pago_ok;
    IF NOT v_pago_ok THEN
      RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: el pago recibido aún no está aplicado a la nueva factura'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_c.pago_nuevo_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_mov_pendiente
      FROM public.bbva_movimientos
      WHERE pago_factura_id = v_c.pago_nuevo_id AND estado_conciliacion <> 'Conciliado';
      IF v_mov_pendiente > 0 THEN
        RAISE EXCEPTION 'LC_REFACT_CIERRE_INCONSISTENTE: el movimiento bancario quedó sin conciliar'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  UPDATE public.refacturaciones
     SET estado = CASE WHEN p_cancelar THEN 'cancelado' ELSE 'completado' END,
         paso_actual = CASE WHEN p_cancelar THEN paso_actual ELSE 5 END,
         cerrado_at = now()
   WHERE id = p_caso_id;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_c.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    CASE WHEN p_cancelar THEN 'refacturacion_cancelada' ELSE 'refacturacion_completada' END,
    'facturacion', v_c.factura_original_id, '',
    jsonb_build_object('caso_id', p_caso_id, 'factura_nueva_id', v_c.factura_nueva_id)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cerrar_caso_refacturacion(uuid, boolean) TO authenticated, service_role;