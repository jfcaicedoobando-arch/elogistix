-- R4: flujos reales sobre Postgres efímero de CI, aislados con ROLLBACK.
BEGIN;
DO $test$
DECLARE
  v_org uuid; v_uid uuid := gen_random_uuid(); v_cli uuid; v_emb uuid;
  v_req uuid := gen_random_uuid(); v_payload jsonb; v_resp jsonb;
  v_cv uuid; v_ids uuid[] := ARRAY[]::uuid[]; v_pf public.proformas;
  v_e public.embarques; v_n integer; v_error text; i integer;
BEGIN
  INSERT INTO public.organizations(nombre, rfc, plan, activo)
    VALUES ('TEST R4 FORWARDER MTY', 'TR4000000XX0', 'basico', true) RETURNING id INTO v_org;
  INSERT INTO auth.users(id, email) VALUES(v_uid, 'r4-mty@example.invalid');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES(v_org, v_uid, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES(v_uid, 'admin_org')
    ON CONFLICT(user_id) DO UPDATE SET role=EXCLUDED.role;
  INSERT INTO public.clientes(organization_id, nombre, rfc, email)
    VALUES(v_org, 'Aceros Mock Apodaca', '', 'r4-aceros@example.invalid') RETURNING id INTO v_cli;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  v_payload := jsonb_build_object('cliente_id', v_cli, 'cliente_nombre', 'Aceros Mock Apodaca',
    'modo', 'Terrestre', 'tipo', 'Nacional', 'ciudad_origen', 'Santa Catarina', 'ciudad_destino', 'Apodaca',
    'peso_kg', 8400, 'volumen_m3', 18.5, 'piezas', 12, 'tipo_cambio_usd', 18.5,
    'seguro', true, 'valor_seguro_usd', 50000, 'dias_libres_destino', 14,
    'dias_almacenaje', 7, 'carta_garantia', true, 'notas', 'Entrega con cita en Apodaca');
  v_resp := public.crear_embarque_completo(v_payload, p_request_id => v_req);
  v_emb := (v_resp->>'id')::uuid;
  SELECT * INTO v_e FROM public.embarques WHERE id=v_emb;
  IF v_e.estado::text <> 'Borrador' OR v_e.expediente IS NOT NULL THEN
    RAISE EXCEPTION 'R4-14: alta incompleta no debe nacer confirmada ni con expediente definitivo';
  END IF;
  IF NOT v_e.seguro OR v_e.valor_seguro_usd <> 50000 OR v_e.dias_libres_destino <> 14
     OR v_e.dias_almacenaje <> 7 OR NOT v_e.carta_garantia
     OR v_e.notas <> 'Entrega con cita en Apodaca' OR v_e.tipo_cambio_usd <> 18.5 THEN
    RAISE EXCEPTION 'R4-11/12: el snapshot comercial no se persistió';
  END IF;
  IF public.crear_embarque_completo(v_payload, p_request_id => v_req) <> v_resp THEN
    RAISE EXCEPTION 'R4: reintento debe devolver el embarque original';
  END IF;
  PERFORM public.actualizar_embarque_completo(v_emb, '{"descripcion_mercancia":"Refacciones CNC"}'::jsonb);
  SELECT * INTO v_e FROM public.embarques WHERE id=v_emb;
  IF NOT v_e.seguro OR v_e.valor_seguro_usd <> 50000 OR v_e.notas <> 'Entrega con cita en Apodaca'
     OR v_e.dias_almacenaje <> 7 OR NOT v_e.carta_garantia THEN
    RAISE EXCEPTION 'R4-12: edición parcial perdió datos que no venían en el payload';
  END IF;
  FOR i IN 1..2 LOOP
    INSERT INTO public.conceptos_venta(embarque_id, organization_id, descripcion, cantidad,
      precio_unitario, moneda, total, aplica_iva, tipo_iva, tasa_iva_aplicada)
    VALUES(v_emb, v_org, 'Maniobras Mock ' || i, 1, 1533.33, 'MXN', 1533.33, true, 'gravado_16', 0.16)
    RETURNING id INTO v_cv;
    v_ids := array_append(v_ids, v_cv);
  END LOOP;
  -- Un override falso no debe modificar el concepto ni dejar una proforma parcial.
  SELECT count(*) INTO v_n FROM public.proformas WHERE organization_id=v_org;
  BEGIN
    PERFORM public.crear_proforma_atomica(v_org, v_emb, v_cli, 'Aceros Mock Apodaca', '', NULL,
      v_ids, 0,0,0,3066.66,0,3066.66,NULL,'MOCK',30,0.16,jsonb_build_object(v_ids[1]::text,false));
    RAISE EXCEPTION 'R4-10: aceptó reclasificar con un booleano';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE 'LC_PROFORMA_IVA_OVERRIDE:%' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.proformas WHERE organization_id=v_org) <> v_n
     OR EXISTS(SELECT 1 FROM public.conceptos_venta WHERE id=ANY(v_ids) AND (NOT aplica_iva OR proforma_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'R4-10: rechazo no fue atómico';
  END IF;
  v_pf := public.crear_proforma_atomica(v_org, v_emb, v_cli, 'Aceros Mock Apodaca', '', NULL,
    v_ids,0,0,0,3066.66,490.66,3557.32,NULL,'MOCK',30,0.16,'{}'::jsonb);
  IF v_pf.subtotal_mxn <> 3066.66 OR v_pf.iva_mxn <> 490.66 OR v_pf.total_mxn <> 3557.32 THEN
    RAISE EXCEPTION 'R4-07: no redondeó por fila (total %, IVA %)', v_pf.total_mxn, v_pf.iva_mxn;
  END IF;
  -- No objeto, exento y tasa cero permanecen explícitos; no se infieren por flag.
  PERFORM public._assert_iva_proforma_coherente('no_objeto', 0, false);
  PERFORM public._assert_iva_proforma_coherente('exento', NULL, false);
  PERFORM public._assert_iva_proforma_coherente('tasa_0', 0, true);
  PERFORM public._assert_iva_proforma_coherente('gravado_8', 0.08, true);
  BEGIN
    PERFORM public._assert_iva_proforma_coherente('gravado_16', 0.16, false);
    RAISE EXCEPTION 'R4-10: permitió gravado con IVA apagado';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE 'LC_PROFORMA_IVA_INCOHERENTE:%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public._assert_iva_proforma_coherente(NULL, 0, false);
    RAISE EXCEPTION 'R4-10: infirió tratamiento de un concepto ambiguo';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE 'LC_PROFORMA_IVA_PENDIENTE:%' THEN RAISE; END IF;
  END;
END;
$test$;
ROLLBACK;
