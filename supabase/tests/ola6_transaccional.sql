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
  v_op1 uuid;
  v_op2 uuid;
  v_emb uuid;
  v_pf uuid;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST OLA6', 'TO6000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  ----------------------------------------------------------------------------
  -- A3: reactivar_cotizacion_rpc
  ----------------------------------------------------------------------------
  INSERT INTO public.cotizaciones (
    organization_id, estado, estado_anterior, folio, modo, tipo, conceptos_venta
  ) VALUES (
    v_org, 'Vencida'::public.estado_cotizacion, 'Enviada'::public.estado_cotizacion,
    'COT-OLA6-0001', 'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
    '[{"descripcion":"FLETE OLA6","cantidad":1,"precio_unitario":1000,"moneda":"USD","aplica_iva":false}]'::jsonb
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
  UPDATE public.cotizaciones SET es_prospecto = true, cliente_id = NULL WHERE id = v_cot;

  v_res := public.convertir_prospecto_a_cliente_rpc(
    v_cot,
    jsonb_build_object('nombre', 'PROSPECTO OLA6', 'rfc', 'XAXX010101000', 'email', 'p@ola6.local')
  );
  IF (v_res->>'creado')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: la primera conversión debía crear el cliente';
  END IF;
  v_cli := (v_res->>'cliente_id')::uuid;

  v_res := public.convertir_prospecto_a_cliente_rpc(
    v_cot,
    jsonb_build_object('nombre', 'PROSPECTO OLA6', 'rfc', 'XAXX010101000')
  );
  IF (v_res->>'creado')::boolean IS NOT FALSE OR (v_res->>'cliente_id')::uuid <> v_cli THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: la segunda conversión duplicó el cliente';
  END IF;
  IF (SELECT count(*) FROM public.clientes WHERE organization_id = v_org) <> 1 THEN
    RAISE EXCEPTION 'OLA6 M3 FAIL: se crearon clientes extra en la organización';
  END IF;

  ----------------------------------------------------------------------------
  -- M4: convertir_lead_rpc (atómico e idempotente)
  ----------------------------------------------------------------------------
  INSERT INTO public.crm_etapas_pipeline (organization_id, nombre, tipo, orden, activa, probabilidad_default)
  VALUES (v_org, 'Prospección OLA6', 'abierta', 1, true, 20)
  RETURNING id INTO v_etapa;

  INSERT INTO public.crm_leads (organization_id, empresa, estado)
  VALUES (v_org, 'LEAD OLA6', 'Nuevo'::public.crm_lead_estado)
  RETURNING id INTO v_lead;

  v_res := public.convertir_lead_rpc(v_lead, true, NULL, 'OP OLA6', 5000, 'USD', NULL);
  v_op1 := (v_res->>'oportunidad_id')::uuid;
  IF v_op1 IS NULL THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: no se creó la oportunidad';
  END IF;

  v_res := public.convertir_lead_rpc(v_lead, true, NULL, 'OP OLA6', 5000, 'USD', NULL);
  v_op2 := (v_res->>'oportunidad_id')::uuid;
  IF v_op2 <> v_op1 THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: la reconversión duplicó la oportunidad';
  END IF;
  IF (SELECT count(*) FROM public.crm_oportunidades WHERE organization_id = v_org) <> 1 THEN
    RAISE EXCEPTION 'OLA6 M4 FAIL: hay oportunidades duplicadas';
  END IF;

  ----------------------------------------------------------------------------
  -- M15: eliminar_proforma_rpc bloquea proformas facturadas
  ----------------------------------------------------------------------------
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, estado, modo, tipo)
  VALUES (v_org, v_cli, 'EXP-OLA6', 'Documentación'::public.estado_embarque,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.proformas (
    organization_id, numero, embarque_id, cliente_id, cliente_nombre, expediente,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn, estado_proforma
  ) VALUES (
    v_org, 'PF-OLA6-1', v_emb, v_cli, 'PROSPECTO OLA6', 'EXP-OLA6',
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

  -- Limpieza
  DELETE FROM public.proformas WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.crm_oportunidades WHERE organization_id = v_org;
  DELETE FROM public.crm_leads WHERE organization_id = v_org;
  DELETE FROM public.crm_etapas_pipeline WHERE organization_id = v_org;
  DELETE FROM public.cotizaciones WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;

  RAISE NOTICE 'OK ola6_transaccional (A3, M3, M4, M15)';
END$$;
