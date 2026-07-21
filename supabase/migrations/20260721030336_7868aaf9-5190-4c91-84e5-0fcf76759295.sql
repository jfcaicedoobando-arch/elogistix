-- ============================================================
-- FIX-13 · Comisiones multi-moneda: usar convertir_a_mxn en vez de
-- CASE WHEN moneda='USD' THEN tc ELSE 1 END (que trataba EUR como MXN).
-- ============================================================
CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid;
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric;
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;
  SELECT vendedora_id, COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO v_vendedora_id, v_tc_usd, v_tc_eur
    FROM embarques WHERE id = v_embarque_id;

  -- FIX-13: para el monto cobrado en MXN respetamos el TC del pago si es
  -- válido; si el pago no es MXN y no trae TC, tomamos el del embarque.
  v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
  IF v_pago.moneda::text = 'MXN' THEN
    v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto);
  ELSIF v_tc_pago IS NOT NULL AND v_tc_pago > 0 THEN
    v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) * v_tc_pago;
  ELSE
    -- Sin TC en el pago: derivamos del embarque según moneda.
    v_cobrado_mxn := public.convertir_a_mxn(
      COALESCE(v_pago.monto_aplicado_factura, v_pago.monto),
      v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
    );
  END IF;

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT COALESCE(porcentaje_default, 0) INTO v_pct
    FROM vendedora_config
   WHERE organization_id = v_pago.organization_id
     AND user_id = v_vendedora_id AND activa = true;
  v_pct := COALESCE(v_pct, 0);

  -- FIX-13: ingresos y costos en MXN convirtiendo cada partida según su
  -- moneda con los TC del embarque. Antes: CASE USD → tc ELSE 1 END
  -- (EUR se sumaba como MXN, comisión subvaluada).
  SELECT COALESCE(SUM(public.convertir_a_mxn(
           cv.total, cv.moneda::text,
           NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
    INTO v_ingresos_mxn
    FROM conceptos_venta cv
   WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

  SELECT COALESCE(SUM(public.convertir_a_mxn(
           cc.monto, cc.moneda::text,
           NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
    INTO v_costos_mxn
    FROM conceptos_costo cc
   WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

  v_utilidad := v_ingresos_mxn - v_costos_mxn;
  v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                       THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                       ELSE 0 END;
  v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
  v_nota := CASE
    WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
    WHEN v_tc_usd = 0 OR v_tc_eur = 0 THEN 'Tipos de cambio del embarque incompletos'
    ELSE NULL
  END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$;

COMMENT ON FUNCTION public.calcular_comision_pago(uuid) IS
'FIX-13: convierte ingresos y costos con convertir_a_mxn(moneda, tc_usd, tc_eur) del embarque; ya no colapsa EUR a MXN.';

-- ============================================================
-- FIX-15 · Optimistic locking en actualizar_embarque_completo.
-- Se elimina la sobrecarga legacy de 4 args y se redefine la de 5 args
-- añadiendo `p_expected_updated_at timestamptz DEFAULT NULL`.
-- Si viene y no coincide con `embarques.updated_at`, se rechaza con
-- `LC_CONFLICTO_CONCURRENCIA` para que la UI pida recargar.
-- ============================================================
DROP FUNCTION IF EXISTS public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.actualizar_embarque_completo(
  p_embarque_id uuid,
  p_embarque jsonb,
  p_conceptos_venta jsonb DEFAULT '[]'::jsonb,
  p_conceptos_costo jsonb DEFAULT '[]'::jsonb,
  p_request_id uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  cv jsonb;
  cc jsonb;
  v_incoming_venta_ids uuid[];
  v_incoming_costo_ids uuid[];
  v_new_id uuid;
  v_current_updated_at timestamptz;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_embarque_completo');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  -- Lock la fila y lee tanto org como updated_at atómicamente. Esto
  -- evita carreras entre la verificación optimista y el UPDATE.
  SELECT organization_id, updated_at
    INTO v_org_id, v_current_updated_at
    FROM embarques
   WHERE id = p_embarque_id
   FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  -- FIX-15: si el cliente envió el timestamp que leyó al abrir el wizard,
  -- verificamos que nadie más haya guardado en el mientras. `IS DISTINCT
  -- FROM` maneja correctamente el caso de nulos.
  IF p_expected_updated_at IS NOT NULL
     AND v_current_updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: otro usuario modificó este embarque. Recarga y vuelve a intentar.'
      USING ERRCODE = '40001',
            HINT = json_build_object(
              'server_updated_at', v_current_updated_at,
              'client_expected_updated_at', p_expected_updated_at
            )::text;
  END IF;

  UPDATE embarques SET
    cliente_id = COALESCE((p_embarque->>'cliente_id')::uuid, cliente_id),
    cliente_nombre = COALESCE(p_embarque->>'cliente_nombre', cliente_nombre),
    modo = COALESCE((p_embarque->>'modo')::modo_transporte, modo),
    tipo = COALESCE((p_embarque->>'tipo')::tipo_operacion, tipo),
    incoterm = COALESCE((p_embarque->>'incoterm')::incoterm, incoterm),
    bl_master = CASE WHEN p_embarque ? 'bl_master' THEN p_embarque->>'bl_master' ELSE bl_master END,
    bl_house = CASE WHEN p_embarque ? 'bl_house' THEN p_embarque->>'bl_house' ELSE bl_house END,
    naviera = CASE WHEN p_embarque ? 'naviera' THEN p_embarque->>'naviera' ELSE naviera END,
    naviera_id = CASE WHEN p_embarque ? 'naviera_id' THEN NULLIF(p_embarque->>'naviera_id','')::uuid ELSE naviera_id END,
    puerto_origen = CASE WHEN p_embarque ? 'puerto_origen' THEN p_embarque->>'puerto_origen' ELSE puerto_origen END,
    puerto_destino = CASE WHEN p_embarque ? 'puerto_destino' THEN p_embarque->>'puerto_destino' ELSE puerto_destino END,
    aeropuerto_origen = CASE WHEN p_embarque ? 'aeropuerto_origen' THEN p_embarque->>'aeropuerto_origen' ELSE aeropuerto_origen END,
    aeropuerto_destino = CASE WHEN p_embarque ? 'aeropuerto_destino' THEN p_embarque->>'aeropuerto_destino' ELSE aeropuerto_destino END,
    ciudad_origen = CASE WHEN p_embarque ? 'ciudad_origen' THEN p_embarque->>'ciudad_origen' ELSE ciudad_origen END,
    ciudad_destino = CASE WHEN p_embarque ? 'ciudad_destino' THEN p_embarque->>'ciudad_destino' ELSE ciudad_destino END,
    aerolinea = CASE WHEN p_embarque ? 'aerolinea' THEN p_embarque->>'aerolinea' ELSE aerolinea END,
    transportista = CASE WHEN p_embarque ? 'transportista' THEN p_embarque->>'transportista' ELSE transportista END,
    agente = CASE WHEN p_embarque ? 'agente' THEN p_embarque->>'agente' ELSE agente END,
    agente_id = CASE WHEN p_embarque ? 'agente_id' THEN NULLIF(p_embarque->>'agente_id','')::uuid ELSE agente_id END,
    shipper = COALESCE(p_embarque->>'shipper', shipper),
    consignatario = COALESCE(p_embarque->>'consignatario', consignatario),
    descripcion_mercancia = COALESCE(p_embarque->>'descripcion_mercancia', descripcion_mercancia),
    tipo_carga = COALESCE(p_embarque->>'tipo_carga', tipo_carga),
    tipo_servicio = CASE WHEN p_embarque ? 'tipo_servicio' THEN (p_embarque->>'tipo_servicio')::tipo_servicio_maritimo ELSE tipo_servicio END,
    operador = COALESCE(p_embarque->>'operador', operador),
    contenedor = CASE WHEN p_embarque ? 'contenedor' THEN p_embarque->>'contenedor' ELSE contenedor END,
    tipo_contenedor = CASE WHEN p_embarque ? 'tipo_contenedor' THEN p_embarque->>'tipo_contenedor' ELSE tipo_contenedor END,
    peso_kg = COALESCE((p_embarque->>'peso_kg')::numeric, peso_kg),
    volumen_m3 = COALESCE((p_embarque->>'volumen_m3')::numeric, volumen_m3),
    piezas = COALESCE((p_embarque->>'piezas')::int, piezas),
    mawb = CASE WHEN p_embarque ? 'mawb' THEN p_embarque->>'mawb' ELSE mawb END,
    hawb = CASE WHEN p_embarque ? 'hawb' THEN p_embarque->>'hawb' ELSE hawb END,
    carta_porte = CASE WHEN p_embarque ? 'carta_porte' THEN p_embarque->>'carta_porte' ELSE carta_porte END,
    etd = CASE WHEN p_embarque ? 'etd' THEN (p_embarque->>'etd')::date ELSE etd END,
    eta = CASE WHEN p_embarque ? 'eta' THEN (p_embarque->>'eta')::date ELSE eta END,
    tipo_cambio_usd = COALESCE((p_embarque->>'tipo_cambio_usd')::numeric, tipo_cambio_usd),
    tipo_cambio_eur = COALESCE((p_embarque->>'tipo_cambio_eur')::numeric, tipo_cambio_eur),
    msds_archivo = CASE WHEN p_embarque ? 'msds_archivo' THEN p_embarque->>'msds_archivo' ELSE msds_archivo END,
    updated_at = now()
  WHERE id = p_embarque_id;

  v_incoming_venta_ids := ARRAY(
    SELECT (elem->>'id')::uuid
      FROM jsonb_array_elements(p_conceptos_venta) elem
     WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> ''
  );

  FOR cv IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
    IF cv ? 'id' AND cv->>'id' IS NOT NULL AND cv->>'id' <> '' THEN
      UPDATE conceptos_venta SET
        descripcion = COALESCE(cv->>'descripcion', descripcion),
        cantidad = COALESCE((cv->>'cantidad')::int, cantidad),
        precio_unitario = COALESCE((cv->>'precio_unitario')::numeric, precio_unitario),
        moneda = COALESCE((cv->>'moneda')::moneda, moneda),
        total = COALESCE((cv->>'total')::numeric, total)
      WHERE id = (cv->>'id')::uuid
        AND embarque_id = p_embarque_id
        AND estado_facturacion IN ('pendiente', 'en_proforma');
    ELSE
      INSERT INTO conceptos_venta (
        embarque_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id
      )
      VALUES (
        p_embarque_id, cv->>'descripcion', (cv->>'cantidad')::int,
        (cv->>'precio_unitario')::numeric, (cv->>'moneda')::moneda,
        (cv->>'total')::numeric, v_org_id
      )
      RETURNING id INTO v_new_id;
      v_incoming_venta_ids := array_append(v_incoming_venta_ids, v_new_id);
    END IF;
  END LOOP;

  UPDATE conceptos_venta
     SET deleted_at = now()
   WHERE embarque_id = p_embarque_id
     AND deleted_at IS NULL
     AND estado_facturacion = 'pendiente'
     AND proforma_id IS NULL
     AND NOT (id = ANY(v_incoming_venta_ids));

  v_incoming_costo_ids := ARRAY(
    SELECT (elem->>'id')::uuid
      FROM jsonb_array_elements(p_conceptos_costo) elem
     WHERE elem ? 'id' AND elem->>'id' IS NOT NULL AND elem->>'id' <> ''
  );

  FOR cc IN SELECT * FROM jsonb_array_elements(p_conceptos_costo) LOOP
    IF cc ? 'id' AND cc->>'id' IS NOT NULL AND cc->>'id' <> '' THEN
      UPDATE conceptos_costo SET
        concepto = COALESCE(cc->>'concepto', concepto),
        proveedor_nombre = COALESCE(cc->>'proveedor_nombre', proveedor_nombre),
        proveedor_id = CASE
          WHEN cc ? 'proveedor_id' AND cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> ''
            THEN (cc->>'proveedor_id')::uuid
          ELSE proveedor_id
        END,
        moneda = COALESCE((cc->>'moneda')::moneda, moneda),
        monto = COALESCE((cc->>'monto')::numeric, monto)
      WHERE id = (cc->>'id')::uuid
        AND embarque_id = p_embarque_id
        AND COALESCE(estado_liquidacion, 'Pendiente') <> 'Pagado';
    ELSE
      INSERT INTO conceptos_costo (
        embarque_id, concepto, proveedor_nombre, proveedor_id, moneda, monto, organization_id
      )
      VALUES (
        p_embarque_id, cc->>'concepto', COALESCE(cc->>'proveedor_nombre', ''),
        CASE WHEN cc->>'proveedor_id' IS NOT NULL AND cc->>'proveedor_id' <> ''
             THEN (cc->>'proveedor_id')::uuid ELSE NULL END,
        (cc->>'moneda')::moneda, (cc->>'monto')::numeric, v_org_id
      )
      RETURNING id INTO v_new_id;
      v_incoming_costo_ids := array_append(v_incoming_costo_ids, v_new_id);
    END IF;
  END LOOP;

  UPDATE conceptos_costo
     SET deleted_at = now()
   WHERE embarque_id = p_embarque_id
     AND deleted_at IS NULL
     AND COALESCE(estado_liquidacion, 'Pendiente') <> 'Pagado'
     AND NOT (id = ANY(v_incoming_costo_ids));

  v_resp := jsonb_build_object('id', p_embarque_id);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

COMMENT ON FUNCTION public.actualizar_embarque_completo(uuid, jsonb, jsonb, jsonb, uuid, timestamptz) IS
'FIX-15: bloqueo optimista vía p_expected_updated_at. Sigue soportando llamadas sin ese parámetro.';