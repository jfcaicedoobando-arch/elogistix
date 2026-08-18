-- ============================================================
-- Etapa 2 · BUG-02: recalcular cabecera de proveedor_facturas
-- ============================================================
CREATE OR REPLACE FUNCTION public.reemplazar_conceptos_factura_proveedor(
  p_factura_id uuid,
  p_conceptos jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_f public.proveedor_facturas%ROWTYPE;
  v_pagado numeric := 0;
  v_insertados int := 0;
  v_subtotal numeric := 0;
  v_iva numeric := 0;
  v_ieps numeric := 0;
BEGIN
  SELECT * INTO v_f FROM public.proveedor_facturas
   WHERE id = p_factura_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_NOT_FOUND: la factura no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_f.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_ELIMINADA: la factura está en la papelera' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_f.organization_id)
     AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: factura de otra organización' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'super_admin')
          OR public.has_role(auth.uid(), 'admin_org')
          OR public.has_role(auth.uid(), 'contador')
          OR public.has_role(auth.uid(), 'auxiliar_contable')
          OR public.has_role(auth.uid(), 'tesorero')) THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FORBIDDEN: sin permiso para editar los conceptos de la factura'
      USING ERRCODE = '42501';
  END IF;

  IF v_f.uuid_fiscal IS NOT NULL OR v_f.archivo_xml_url IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CONCEPTOS_FISCALES: los conceptos vienen del XML del CFDI; vuelve a adjuntar el XML para cambiarlos'
      USING ERRCODE = '22023';
  END IF;

  IF v_f.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_FACTURA_CANCELADA: la factura está cancelada' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;
  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'LC_FACTURA_CON_PAGOS: la factura tiene pagos aplicados por %; elimina los pagos antes de editar los conceptos', v_pagado
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id
     AND concepto_costo_id IS NULL;

  INSERT INTO public.proveedor_facturas_conceptos
    (proveedor_factura_id, organization_id, concepto_costo_id,
     descripcion, cantidad, clave_unidad, monto, iva, ieps)
  SELECT p_factura_id,
         v_f.organization_id,
         NULL,
         COALESCE(NULLIF(btrim(x->>'descripcion'), ''), '(Sin descripción)'),
         COALESCE(NULLIF(x->>'cantidad', '')::numeric, 1),
         NULLIF(btrim(COALESCE(x->>'clave_unidad', '')), ''),
         COALESCE(NULLIF(x->>'monto', '')::numeric, 0),
         COALESCE(NULLIF(x->>'iva', '')::numeric, 0),
         COALESCE(NULLIF(x->>'ieps', '')::numeric, 0)
    FROM jsonb_array_elements(COALESCE(p_conceptos, '[]'::jsonb)) AS x;
  GET DIAGNOSTICS v_insertados = ROW_COUNT;

  -- BUG-02 (auditoría 2026-08-18): la cabecera debe cuadrar con sus renglones.
  -- `guard_proveedor_factura_total` recalcula `total` a partir de estos campos.
  SELECT COALESCE(SUM(monto), 0), COALESCE(SUM(iva), 0), COALESCE(SUM(ieps), 0)
    INTO v_subtotal, v_iva, v_ieps
    FROM public.proveedor_facturas_conceptos
   WHERE proveedor_factura_id = p_factura_id;

  UPDATE public.proveedor_facturas
     SET subtotal = ROUND(v_subtotal, 2),
         iva      = ROUND(v_iva, 2),
         ieps     = ROUND(v_ieps, 2),
         estado_aprobacion = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN 'pendiente'::public.estado_aprobacion_factura_proveedor
           ELSE estado_aprobacion END,
         aprobada_por = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_por END,
         aprobada_at = CASE
           WHEN estado_aprobacion = 'aprobada'::public.estado_aprobacion_factura_proveedor
             THEN NULL ELSE aprobada_at END,
         updated_at = now()
   WHERE id = p_factura_id;

  RETURN v_insertados;
END;
$$;

REVOKE ALL ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reemplazar_conceptos_factura_proveedor(uuid, jsonb) TO authenticated, service_role;

-- ============================================================
-- Etapa 2 · BUG-04: saldo_factura convierte notas de crédito
-- ============================================================
CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
  v_moneda text; v_tc numeric;
BEGIN
  SELECT total, estado, organization_id, moneda::text, tipo_cambio
    INTO v_total, v_estado, v_org, v_moneda, v_tc
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  -- BUG-04 (auditoría 2026-08-18): misma conversión que `cartera_pendiente`.
  -- Si la NC no se puede convertir (falta TC) NO se resta: preferimos un saldo
  -- mayor a marcar como Pagada una factura que no lo está.
  SELECT COALESCE(SUM(
      CASE
        WHEN nc.moneda::text = v_moneda THEN nc.monto
        WHEN v_moneda = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
          THEN nc.monto * nc.tipo_cambio
        WHEN v_moneda <> 'MXN' AND nc.moneda::text = 'MXN' AND v_tc > 1
          THEN nc.monto / v_tc
        WHEN v_moneda <> 'MXN' AND nc.moneda::text <> 'MXN'
             AND v_moneda <> nc.moneda::text
             AND nc.tipo_cambio > 1 AND v_tc > 1
          THEN (nc.monto * nc.tipo_cambio) / v_tc
        ELSE 0
      END), 0) INTO v_ncs
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = p_factura_id AND nc.deleted_at IS NULL AND nc.estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

REVOKE ALL ON FUNCTION public.saldo_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

-- Candado de escritura: no se puede Aplicar una NC cross-currency sin TC.
CREATE OR REPLACE FUNCTION public.guard_nc_cliente_moneda_convertible()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_moneda text; v_tc numeric;
BEGIN
  IF NEW.estado <> 'Aplicada'::public.estado_nota_credito THEN RETURN NEW; END IF;

  SELECT f.moneda::text, f.tipo_cambio INTO v_moneda, v_tc
  FROM public.facturas f WHERE f.id = NEW.factura_id;
  IF v_moneda IS NULL OR NEW.moneda::text = v_moneda THEN RETURN NEW; END IF;

  IF NEW.moneda::text <> 'MXN' AND COALESCE(NEW.tipo_cambio, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_NC_MONEDA_SIN_TC: captura el tipo de cambio de la nota de crédito en % antes de aplicarla', NEW.moneda
      USING ERRCODE = '22023';
  END IF;
  IF v_moneda <> 'MXN' AND COALESCE(v_tc, 0) <= 1 THEN
    RAISE EXCEPTION 'LC_NC_MONEDA_SIN_TC: la factura en % no tiene tipo de cambio para convertir la nota de crédito', v_moneda
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_nc_cliente_moneda_convertible() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_nc_cliente_moneda_convertible() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_nc_cliente_moneda_convertible ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_cliente_moneda_convertible
  BEFORE INSERT OR UPDATE OF estado, moneda, tipo_cambio
  ON public.factura_notas_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_nc_cliente_moneda_convertible();

-- ============================================================
-- Etapa 2 · BUG-07: eliminar_pago_proveedor revierte anticipos
-- ============================================================
CREATE OR REPLACE FUNCTION public.eliminar_pago_proveedor(_pago_id uuid, _motivo text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pago record;
  v_baja int := 0;
  v_desvinculados int := 0;
  v_costos int := 0;
  v_anticipos int := 0;
BEGIN
  SELECT id, proveedor_factura_id, organization_id, deleted_at, monto, moneda
    INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = _pago_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago % no existe', _pago_id USING ERRCODE = 'P0002';
  END IF;

  IF v_pago.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'pago_id', _pago_id, 'ya_eliminado', true,
      'movimientos_baja', 0, 'movimientos_desvinculados', 0, 'costos_recalculados', 0,
      'anticipos_revertidos', 0
    );
  END IF;

  IF NOT public.has_role(v_uid, 'super_admin'::app_role)
     AND v_pago.organization_id IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: el pago pertenece a otra organizacion'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.es_escritor_financiero(v_uid) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: tu rol no puede eliminar pagos'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.pagos_proveedor
     SET deleted_at = now(), deleted_by = v_uid
   WHERE id = _pago_id AND deleted_at IS NULL;

  -- BUG-07 (auditoría 2026-08-18): si el pago venía de un anticipo, la
  -- aplicación debe revertirse en la MISMA transacción; el trigger
  -- `trg_anticipo_saldo` recalcula saldo_disponible y estado del anticipo.
  WITH rev AS (
    UPDATE public.anticipos_aplicaciones
       SET deleted_at = now(), deleted_by = v_uid, updated_at = now()
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_anticipos FROM rev;

  WITH baja AS (
    UPDATE public.bbva_movimientos
       SET deleted_at = now(), deleted_by = v_uid
     WHERE deleted_at IS NULL
       AND (pago_proveedor_id = _pago_id OR hash_dedupe = 'pago-' || _pago_id::text)
       AND hash_dedupe = 'pago-' || _pago_id::text
    RETURNING 1
  )
  SELECT count(*) INTO v_baja FROM baja;

  WITH libre AS (
    UPDATE public.bbva_movimientos
       SET pago_proveedor_id = NULL,
           estado_conciliacion = 'Pendiente'::estado_conciliacion,
           conciliado_por = NULL,
           conciliado_at = NULL
     WHERE pago_proveedor_id = _pago_id
       AND deleted_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_desvinculados FROM libre;

  SELECT count(DISTINCT pfc.concepto_costo_id) INTO v_costos
  FROM public.proveedor_facturas_conceptos pfc
  WHERE pfc.proveedor_factura_id = v_pago.proveedor_factura_id
    AND pfc.concepto_costo_id IS NOT NULL;

  INSERT INTO public.bitacora_actividad
    (usuario_id, usuario_email, accion, modulo, entidad_id, detalles, organization_id)
  VALUES (
    COALESCE(v_uid, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE((SELECT u.email FROM auth.users u WHERE u.id = v_uid), 'sistema'),
    'eliminar_pago', 'cxp', v_pago.proveedor_factura_id,
    jsonb_build_object(
      'pago_id', _pago_id,
      'monto', v_pago.monto,
      'moneda', v_pago.moneda,
      'motivo', _motivo,
      'movimientos_baja', v_baja,
      'movimientos_desvinculados', v_desvinculados,
      'costos_recalculados', v_costos,
      'anticipos_revertidos', v_anticipos,
      'atomico', true
    ),
    v_pago.organization_id
  );

  RETURN jsonb_build_object(
    'pago_id', _pago_id,
    'proveedor_factura_id', v_pago.proveedor_factura_id,
    'ya_eliminado', false,
    'movimientos_baja', v_baja,
    'movimientos_desvinculados', v_desvinculados,
    'costos_recalculados', v_costos,
    'anticipos_revertidos', v_anticipos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.eliminar_pago_proveedor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_pago_proveedor(uuid, text) TO authenticated, service_role;

-- ============================================================
-- Etapa 2 · BUG-08: refacturación toma el TC DOF del día
-- ============================================================
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
  v_tc_nuevo numeric;
  v_factor numeric;
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

  -- BUG-08 (auditoría 2026-08-18): el CFDI de sustitución se timbra HOY, así
  -- que el tipo de cambio debe ser el DOF vigente a la nueva fecha de emisión,
  -- no el heredado de la factura original.
  IF v_old.moneda::text = 'MXN' THEN
    v_tc_nuevo := v_old.tipo_cambio;
  ELSE
    SELECT CASE WHEN v_old.moneda::text = 'USD' THEN d.usd_mxn
                WHEN v_old.moneda::text = 'EUR' THEN d.eur_mxn END
      INTO v_tc_nuevo
    FROM public.tc_dof_vigente(CURRENT_DATE) d;
    IF v_tc_nuevo IS NULL OR v_tc_nuevo <= 1 THEN
      v_tc_nuevo := NULL;  -- sin DOF: el timbrado exige capturarlo a mano.
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