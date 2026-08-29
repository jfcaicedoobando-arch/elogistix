-- Fuente canónica de public.duplicar_factura_para_refacturacion.
-- v13.646.0 (BUG-08): la factura sustituta toma el TC DOF vigente a su fecha de
-- emisión en lugar de heredar el TC de la factura original.

CREATE OR REPLACE FUNCTION public.duplicar_factura_para_refacturacion(p_caso_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_cli public.clientes%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
  v_estado_nueva text;
  v_tc_nuevo numeric;
  v_factor numeric;
BEGIN
  -- N18: FOR UPDATE serializa la duplicación del mismo caso (doble clic).
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id FOR UPDATE;
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

  IF v_old.moneda::text = 'MXN' THEN
    v_tc_nuevo := v_old.tipo_cambio;
  ELSE
    SELECT CASE WHEN v_old.moneda::text = 'USD' THEN d.usd_mxn
                WHEN v_old.moneda::text = 'EUR' THEN d.eur_mxn END
      INTO v_tc_nuevo
    FROM public.tc_dof_vigente(CURRENT_DATE) d;
    IF v_tc_nuevo IS NULL OR v_tc_nuevo <= 1 THEN
      v_tc_nuevo := NULL;
    END IF;
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
    v_old.cotizacion_id, v_old.embarque_id, NULL,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE,
    CURRENT_DATE + COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    v_old.moneda, v_tc_nuevo, v_old.subtotal, v_old.iva,
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

  v_factor := CASE WHEN COALESCE(v_old.tipo_cambio, 0) > 0 AND v_tc_nuevo IS NOT NULL
                   THEN ROUND(v_tc_nuevo / v_old.tipo_cambio, 6) ELSE NULL END;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_borrador_creado', 'facturacion', v_new_id, COALESCE(v_new_numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'factura_original_id', v_old.id,
                       'cliente_destino_id', v_cli.id, 'rfc_destino', v_cli.rfc,
                       'ruta_fiscal', v_c.ruta_fiscal, 'proforma_origen_id', v_old.proforma_id,
                       'tc_original', v_old.tipo_cambio, 'tc_nuevo_dof', v_tc_nuevo,
                       'tc_factor', v_factor)
  );

  RETURN v_new_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_factura_para_refacturacion(uuid) TO authenticated, service_role;
