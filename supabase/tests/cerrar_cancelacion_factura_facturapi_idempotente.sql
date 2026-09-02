-- v13.xxx.x · cerrar_cancelacion_factura_facturapi: idempotencia + Sustituida.
-- Cubre lo que el webhook y facturapi-cancelar comparten ahora vía RPC:
--   · CASO 1: sin sustituida_por_factura_id -> estado Cancelada, factura_embarques
--     desactivados, proforma liberada.
--   · CASO 2: con sustituida_por_factura_id -> estado Sustituida.
--   · CASO 3: segunda llamada (misma factura, ya cerrada) es no-op: no cambia
--     estado ni vuelve a tocar cancelado_en/cancelacion_solicitada_en, y
--     `ya_cerrada` = true.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/cerrar_cancelacion_factura_facturapi_idempotente.sql
DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_f1 uuid;
  v_f2 uuid;
  v_pf uuid;
  v_res jsonb;
  v_res2 jsonb;
  v_estado public.estado_factura;
  v_cancelado_en1 timestamptz;
  v_cancelado_en2 timestamptz;
  v_activa boolean;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CIERRE CANCELACION', 'TCC010101XX1', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'cierre-cancel@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org') ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CIERRE', '', 'cierre-cancel@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELCIE0001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.proformas (
    organization_id, cliente_id, cliente_nombre, embarque_id, expediente, numero, estado_proforma
  ) VALUES (
    v_org, v_cli, 'CLIENTE CIERRE', v_emb, 'ELCIE0001', 'PF-CIERRE-0001', 'facturada'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.facturas (
    organization_id, numero, cliente_id, cliente_nombre, fecha_vencimiento,
    estado, proforma_id, cancellation_status
  ) VALUES (
    v_org, 'F-CIERRE-0001', v_cli, 'CLIENTE CIERRE', CURRENT_DATE + 30,
    'Emitida'::public.estado_factura, v_pf, 'pending'
  ) RETURNING id INTO v_f1;

  INSERT INTO public.facturas (
    organization_id, numero, cliente_id, cliente_nombre, fecha_vencimiento,
    estado, cancellation_status
  ) VALUES (
    v_org, 'F-CIERRE-0002-SUSTITUTA', v_cli, 'CLIENTE CIERRE', CURRENT_DATE + 30,
    'Emitida'::public.estado_factura, 'none'
  ) RETURNING id INTO v_f2;

  INSERT INTO public.factura_embarques (organization_id, factura_id, embarque_id, activa)
  VALUES (v_org, v_f1, v_emb, true);

  UPDATE public.proformas SET factura_id = v_f1 WHERE id = v_pf;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- CASO 1: cierre puro (sin sustituta) -> Cancelada.
  v_res := public.cerrar_cancelacion_factura_facturapi(v_f1, NULL, '02');

  SELECT estado, cancelado_en INTO v_estado, v_cancelado_en1 FROM public.facturas WHERE id = v_f1;
  IF v_estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'TEST FAIL: esperaba Cancelada, obtuve %', v_estado;
  END IF;
  IF (v_res->>'ya_cerrada')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'TEST FAIL: la primera llamada no debe reportarse como ya_cerrada';
  END IF;

  SELECT activa INTO v_activa FROM public.factura_embarques WHERE factura_id = v_f1;
  IF v_activa IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'TEST FAIL: factura_embarques debe quedar inactiva';
  END IF;

  IF EXISTS (SELECT 1 FROM public.proformas WHERE id = v_pf AND factura_id = v_f1) THEN
    RAISE EXCEPTION 'TEST FAIL: la proforma debe soltar el puntero a la factura cancelada';
  END IF;

  -- CASO 3 (idempotencia sobre el mismo caso): segunda llamada no cambia nada.
  v_res2 := public.cerrar_cancelacion_factura_facturapi(v_f1, NULL, '02');
  SELECT estado, cancelado_en INTO v_estado, v_cancelado_en2 FROM public.facturas WHERE id = v_f1;
  IF v_estado <> 'Cancelada' OR v_cancelado_en2 IS DISTINCT FROM v_cancelado_en1 THEN
    RAISE EXCEPTION 'TEST FAIL: la segunda llamada no debe alterar estado ni cancelado_en';
  END IF;
  IF (v_res2->>'ya_cerrada')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TEST FAIL: la segunda llamada debe reportar ya_cerrada=true';
  END IF;

  -- CASO 2: con sustituida_por_factura_id -> Sustituida.
  v_res := public.cerrar_cancelacion_factura_facturapi(v_f2, v_f1, '01');
  SELECT estado INTO v_estado FROM public.facturas WHERE id = v_f2;
  IF v_estado <> 'Sustituida' THEN
    RAISE EXCEPTION 'TEST FAIL: esperaba Sustituida, obtuve %', v_estado;
  END IF;
  IF (v_res->>'sustituida_por_factura_id')::uuid IS DISTINCT FROM v_f1 THEN
    RAISE EXCEPTION 'TEST FAIL: sustituida_por_factura_id no coincide';
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.factura_embarques WHERE organization_id = v_org;
  DELETE FROM public.facturas WHERE organization_id = v_org;
  DELETE FROM public.proformas WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  DELETE FROM public.bitacora_actividad WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;
  DELETE FROM auth.users WHERE id = v_uid;

  RAISE NOTICE 'OK: cerrar_cancelacion_factura_facturapi idempotente (Cancelada/Sustituida).';
END $$;
