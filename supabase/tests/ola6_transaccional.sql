-- Ola 6 · Integridad transaccional: RPCs atómicas (A3, M3, M4, M7, M15).
-- Verifica: reactivación de cotización, conversiones idempotentes y borrado de
-- proforma bloqueado cuando ya está facturada.
DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_cot uuid;
  v_estado text;
  v_res jsonb;
  v_lead uuid;
  v_etapa uuid;
  v_etapa_a3 uuid;
  v_lead_a3 uuid;
  v_op_a3 uuid;
  v_op1 uuid;
  v_op2 uuid;
  v_emb uuid;
  v_pf uuid;
  v_tarifa uuid;
  v_agente uuid;
  v_ruta uuid;
  v_prov uuid;
  v_naviera uuid;
  v_tipo uuid;
  v_p1 uuid;
  v_p2 uuid;
  v_n integer;
  v_flete numeric;
  v_admin uuid := 'a06a06a0-0000-4000-8000-000000000001';
  v_etapa_gan uuid;
BEGIN
  -- v13.823.55: convertir_lead_rpc exige sesión real. Esta suite corre como
  -- postgres (sin uid), así que declara el claim de proceso interno.
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);

  INSERT INTO public.organizations (nombre, rfc, plan, activo)

  VALUES ('TEST OLA6', 'TO6000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  -- v13.823.65: convertir_prospecto_a_cliente_rpc exige un usuario firmado con
  -- rol de alta de clientes en la organización. Se siembra la membresía (en CI
  -- sin GoTrue el INSERT en auth.users es best-effort).
  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_admin, 'ola6-admin@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_admin, 'admin_org');

  ----------------------------------------------------------------------------
  -- A3: reactivar_cotizacion_rpc
  -- v13.777.9: enviar (o reactivar a 'Enviada') exige oportunidad del CRM,
  -- así que sembramos etapa + lead calificado + oportunidad de apoyo.
  ----------------------------------------------------------------------------
  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, activa)
  VALUES (v_org, 'Prospección OLA6 A3', 'abierta'::public.crm_etapa_tipo, 1, true)
  RETURNING id INTO v_etapa_a3;

  INSERT INTO public.crm_leads (organization_id, empresa, estado)
  VALUES (v_org, 'LEAD OLA6 A3', 'Calificado'::public.crm_lead_estado)
  RETURNING id INTO v_lead_a3;

  INSERT INTO public.crm_oportunidades (organization_id, nombre, etapa_id, lead_id, monto_estimado, moneda)
  VALUES (v_org, 'OP OLA6 A3', v_etapa_a3, v_lead_a3, 1000, 'MXN')
  RETURNING id INTO v_op_a3;

  INSERT INTO public.cotizaciones (
    organization_id, estado, estado_anterior, folio, modo, tipo, conceptos_venta,
    es_prospecto, prospecto_empresa, oportunidad_id
  ) VALUES (
    v_org, 'Vencida'::public.estado_cotizacion, 'Enviada'::public.estado_cotizacion,
    'COT-OLA6-0001', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
    '[{"descripcion":"FLETE OLA6","cantidad":1,"precio_unitario":1000,"moneda":"USD","aplica_iva":false}]'::jsonb,
    -- v13.777.9: la segmentación comercial exige cliente ligado fuera de
    -- borrador; esta cotización es de prospecto (M3 la convierte a cliente).
    true, 'PROSPECTO OLA6', v_op_a3
  ) RETURNING id INTO v_cot;

  v_estado := public.reactivar_cotizacion_rpc(v_cot);
  IF v_estado <> 'Enviada' THEN
    RAISE EXCEPTION 'OLA6 A3 FAIL: esperaba Enviada, obtuve %', v_estado;
  END IF;

  -- Segunda llamada debe fallar: ya no está vencida/archivada.
  BEGIN
    PERFORM public.reactivar_cotizacion_rpc(v_cot);
    RAISE EXCEPTION 'OLA6 A3 FAIL: reactivar dos veces debería fallar';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%LC_COTIZACION_NO_REACTIVABLE%' THEN RAISE; END IF;
  END;

  ----------------------------------------------------------------------------
  -- M3: convertir_prospecto_a_cliente_rpc (idempotente, sin duplicar clientes)
  ----------------------------------------------------------------------------
  -- v13.823.65: la conversión canónica exige cotización Aceptada, oportunidad
  -- ganadora en etapa 'ganada', prospecto (lead) vivo y captura fiscal completa.
  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, activa)
  VALUES (v_org, 'Ganada OLA6', 'ganada'::public.crm_etapa_tipo, 9, true)
  RETURNING id INTO v_etapa_gan;

  UPDATE public.crm_oportunidades
     SET etapa_id = v_etapa_gan, cotizacion_ganadora_id = v_cot, cliente_id = NULL
   WHERE id = v_op_a3;

  UPDATE public.cotizaciones
     SET es_prospecto = true, cliente_id = NULL,
         estado = 'Aceptada'::public.estado_cotizacion
   WHERE id = v_cot;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  v_res := public.convertir_prospecto_a_cliente_rpc(
    v_cot,
    jsonb_build_object(
      'nombre', 'PROSPECTO OLA6', 'contacto', 'Contacto OLA6',
      'email', 'p@ola6.local', 'telefono', '5555555555',
      'rfc', 'XAXX010101000', 'cp', '01000',
      'regimen_fiscal', '601', 'uso_cfdi_default', 'G03',
      'forma_pago_default', '03', 'metodo_pago_default', 'PUE')
  );
  IF (v_res->>'creado')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: la primera conversión debía crear el cliente';
  END IF;
  v_cli := (v_res->>'cliente_id')::uuid;

  v_res := public.convertir_prospecto_a_cliente_rpc(
    v_cot,
    jsonb_build_object(
      'nombre', 'PROSPECTO OLA6', 'contacto', 'Contacto OLA6',
      'email', 'p@ola6.local', 'telefono', '5555555555',
      'rfc', 'XAXX010101000', 'cp', '01000',
      'regimen_fiscal', '601', 'uso_cfdi_default', 'G03',
      'forma_pago_default', '03', 'metodo_pago_default', 'PUE')
  );
  IF (v_res->>'creado')::boolean IS NOT FALSE OR (v_res->>'cliente_id')::uuid <> v_cli THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: la segunda conversión duplicó el cliente';
  END IF;
  IF (SELECT count(*) FROM public.clientes WHERE organization_id = v_org) <> 1 THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: se crearon clientes extra en la organización';
  END IF;

  -- Se restaura el claim de proceso interno para el resto de la suite.
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'service_role')::text, true);

  ----------------------------------------------------------------------------
  -- M4: convertir_lead_rpc (atómico e idempotente)
  ----------------------------------------------------------------------------
  INSERT INTO public.crm_etapas_pipeline (
    organization_id, nombre, tipo, orden, activa, probabilidad_default, color, dias_seguimiento, crea_tarea_seguimiento
  ) VALUES (v_org, 'Prospección OLA6', 'abierta'::public.crm_etapa_tipo, 1, true, 20, '#2563EB', 3, false)
  RETURNING id INTO v_etapa;

  -- v13.777.9: CRM Fase 2 exige lead calificado para abrir oportunidad.
  INSERT INTO public.crm_leads (organization_id, empresa, estado)
  VALUES (v_org, 'LEAD OLA6', 'Calificado'::public.crm_lead_estado)
  RETURNING id INTO v_lead;

  v_res := public.convertir_lead_rpc(v_lead, false, NULL, 'OP OLA6', 5000, 'USD', NULL);
  v_op1 := (v_res->>'oportunidad_id')::uuid;
  IF v_op1 IS NULL THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: no se creó la oportunidad';
  END IF;

  v_res := public.convertir_lead_rpc(v_lead, false, NULL, 'OP OLA6', 5000, 'USD', NULL);
  v_op2 := (v_res->>'oportunidad_id')::uuid;
  IF v_op2 <> v_op1 THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: la reconversión duplicó la oportunidad';
  END IF;
  IF (SELECT count(*) FROM public.crm_oportunidades WHERE lead_id = v_lead) <> 1 THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: hay oportunidades duplicadas';
  END IF;

  ----------------------------------------------------------------------------
  -- M15: eliminar_proforma_rpc bloquea proformas facturadas
  ----------------------------------------------------------------------------
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELOLA6001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.proformas (
    organization_id, numero, embarque_id, cliente_id, cliente_nombre, expediente,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn, estado_proforma
  ) VALUES (
    v_org, 'PF-OLA6-1', v_emb, v_cli, 'PROSPECTO OLA6', 'ELOLA6001',
    100, 16, 116, 2000, 320, 2320, 'facturada'
  ) RETURNING id INTO v_pf;

  BEGIN
    PERFORM public.eliminar_proforma_rpc(v_pf);
    RAISE EXCEPTION 'OLA6 M15 FAIL: se permitió eliminar una proforma facturada';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%LC_PROFORMA_FACTURADA%' THEN RAISE; END IF;
  END;

  UPDATE public.proformas SET estado_proforma = 'pendiente' WHERE id = v_pf;
  v_res := public.eliminar_proforma_rpc(v_pf);
  IF (v_res->>'eliminada')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'OLA6 M15 FAIL: no se eliminó la proforma pendiente';
  END IF;
  IF (SELECT deleted_at FROM public.proformas WHERE id = v_pf) IS NULL THEN
    RAISE EXCEPTION 'OLA6 M15 FAIL: la proforma no quedó con soft-delete';
  END IF;
  -- Segunda llamada: idempotente, no vuelve a marcar.
  v_res := public.eliminar_proforma_rpc(v_pf);
  IF (v_res->>'eliminada')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION 'OLA6 M15 FAIL: la eliminación no es idempotente';
  END IF;

  ----------------------------------------------------------------------------
  -- M7: actualizar_tarifa_con_recargos_rpc (una sola transacción)
  ----------------------------------------------------------------------------
  -- Catálogos globales: en una base limpia (CI) pueden estar vacíos, se siembran.
  INSERT INTO public.navieras (code, name)
  VALUES ('OLAS', 'NAVIERA OLA6')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.tipos_contenedor (code, name)
  VALUES ('40HC', '40 High Cube')
  ON CONFLICT (code) DO NOTHING;
  INSERT INTO public.puertos (code, name, country)
  VALUES ('CNSHA', 'Shanghai', 'CN'), ('MXZLO', 'Manzanillo', 'MX')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_naviera FROM public.navieras ORDER BY code LIMIT 1;
  SELECT id INTO v_tipo FROM public.tipos_contenedor ORDER BY code LIMIT 1;
  SELECT id INTO v_p1 FROM public.puertos ORDER BY code LIMIT 1;
  SELECT id INTO v_p2 FROM public.puertos ORDER BY code DESC LIMIT 1;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROV OLA6', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor) RETURNING id INTO v_prov;

  INSERT INTO public.costeo_agentes (organization_id, proveedor_id, nombre, pais)
  VALUES (v_org, v_prov, 'AGENTE OLA6', 'CN') RETURNING id INTO v_agente;

  INSERT INTO public.costeo_rutas (organization_id, puerto_origen_id, puerto_destino_id)
  VALUES (v_org, v_p1, v_p2) RETURNING id INTO v_ruta;

  INSERT INTO public.costeo_tarifas (
    organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    flete_base, vigente_desde, vigente_hasta
  ) VALUES (
    v_org, v_agente, v_naviera, v_ruta, v_tipo,
    2000, CURRENT_DATE, CURRENT_DATE + 30
  ) RETURNING id INTO v_tarifa;

  INSERT INTO public.costeo_tarifa_recargos (
    tarifa_id, organization_id, concepto, lado, monto, moneda, incluido_en_total
  ) VALUES (v_tarifa, v_org, 'VIEJO', 'origen', 111, 'USD', true);

  PERFORM public.actualizar_tarifa_con_recargos_rpc(
    v_tarifa,
    jsonb_build_object('flete_base', 2500, 'notas', 'ola6'),
    jsonb_build_array(
      jsonb_build_object('concepto', 'BAF', 'lado', 'origen', 'monto', 100, 'incluido_en_total', true),
      jsonb_build_object('concepto', 'THC', 'lado', 'destino', 'monto', 50, 'incluido_en_total', false),
      jsonb_build_object('concepto', '  ', 'lado', 'origen', 'monto', 80),
      jsonb_build_object('concepto', 'CERO', 'lado', 'origen', 'monto', 0)
    )
  );

  SELECT flete_base INTO v_flete FROM public.costeo_tarifas WHERE id = v_tarifa;
  IF v_flete <> 2500 THEN
    RAISE EXCEPTION 'OLA6 M7 FAIL: flete_base no se actualizó (%)', v_flete;
  END IF;

  SELECT count(*) INTO v_n FROM public.costeo_tarifa_recargos WHERE tarifa_id = v_tarifa;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'OLA6 M7 FAIL: se esperaban 2 recargos válidos, hay %', v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.costeo_tarifa_recargos WHERE tarifa_id = v_tarifa AND concepto = 'VIEJO') THEN
    RAISE EXCEPTION 'OLA6 M7 FAIL: el recargo anterior no fue reemplazado';
  END IF;

  -- Tarifa inexistente: la RPC debe rechazar, no crear nada.
  BEGIN
    PERFORM public.actualizar_tarifa_con_recargos_rpc(
      gen_random_uuid(), '{}'::jsonb, '[]'::jsonb);
    RAISE EXCEPTION 'OLA6 M7 FAIL: se permitió actualizar una tarifa inexistente';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM NOT LIKE '%LC_TARIFA_NO_ENCONTRADA%' THEN RAISE; END IF;
  END;

  -- Limpieza
  DELETE FROM public.costeo_tarifa_recargos WHERE organization_id = v_org;
  DELETE FROM public.costeo_tarifas WHERE organization_id = v_org;
  DELETE FROM public.costeo_rutas WHERE organization_id = v_org;
  DELETE FROM public.costeo_agentes WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.proformas WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.crm_oportunidades WHERE organization_id = v_org;
  DELETE FROM public.crm_leads WHERE organization_id = v_org;
  DELETE FROM public.crm_etapas_pipeline WHERE organization_id = v_org;
  DELETE FROM public.cotizaciones WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  -- La conversión canónica deja huella en la bitácora y la membresía sembrada
  -- también referencia la organización.
  DELETE FROM public.bitacora_actividad WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;

  RAISE NOTICE 'OK ola6_transaccional (A3, M3, M4, M7, M15)';
END$$;
