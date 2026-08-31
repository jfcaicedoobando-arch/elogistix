-- BUG-05 · guard_nc_cliente_transicion / trg_nc_cliente_transicion
-- Verifica: UPDATE directo a 'Aplicada' sin uuid_fiscal se rechaza
-- (LC_NC_UUID_REQUERIDO) y se permite si uuid_fiscal está presente.
-- Fix: supabase/migrations/20260818005136_..._7f0da692...sql (líneas 174-212)
BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_emb uuid;
  v_fac uuid;
  v_nc1 uuid;
  v_nc2 uuid;
  v_state text; v_msg text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST NC UUID FISCAL', 'TNU000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE NC UUID', '', 'cliente.nc.uuid@test.local') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELIMP00901', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.facturas
    (organization_id, embarque_id, cliente_id, cliente_nombre, numero,
     fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado)
  VALUES
    (v_org, v_emb, v_cli, 'CLIENTE NC UUID', 'F-NC-UUID-1',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN', 1000, 160, 1160, 'Emitida')
  RETURNING id INTO v_fac;

  -- Nota de crédito 1: pasará Borrador -> Aprobada -> Timbrada (con uuid) -> intento a Aplicada SIN uuid nuevo (debe fallar solo si limpiamos el uuid).
  INSERT INTO public.factura_notas_credito
    (organization_id, factura_id, folio, motivo, descripcion, monto, moneda, estado)
  VALUES
    (v_org, v_fac, 'NC-UUID-001', 'Otro', 'Prueba BUG-05', 500, 'MXN', 'Borrador')
  RETURNING id INTO v_nc1;

  -- Canon vigente: Borrador -> Timbrada (el paso por 'Aprobada' es legado).
  UPDATE public.factura_notas_credito
     SET estado = 'Timbrada', uuid_fiscal = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEE1'
   WHERE id = v_nc1;

  -- CASO 1: forzar UPDATE directo a 'Aplicada' quitando el uuid_fiscal en el mismo UPDATE
  -- (simula el bug: alguien intenta aplicar sin folio fiscal vigente).
  BEGIN
    UPDATE public.factura_notas_credito
       SET estado = 'Aplicada', uuid_fiscal = NULL
     WHERE id = v_nc1;
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  IF v_state <> '22023' OR v_msg NOT LIKE 'LC_NC_UUID_REQUERIDO%' THEN
    RAISE EXCEPTION 'BUG-05 REGRESIÓN: se esperaba 22023/LC_NC_UUID_REQUERIDO al aplicar sin uuid_fiscal, vino % / %', v_state, v_msg;
  END IF;

  -- Confirma que la nota se quedó en 'Timbrada' (el UPDATE fallido no dejó estado inconsistente).
  IF (SELECT estado::text FROM public.factura_notas_credito WHERE id = v_nc1) <> 'Timbrada' THEN
    RAISE EXCEPTION 'BUG-05 REGRESIÓN: la nota de crédito no debió cambiar de estado tras el rechazo';
  END IF;

  -- CASO 2: con uuid_fiscal presente, Timbrada -> Aplicada debe permitirse.
  UPDATE public.factura_notas_credito SET estado = 'Aplicada' WHERE id = v_nc1;
  IF (SELECT estado::text FROM public.factura_notas_credito WHERE id = v_nc1) <> 'Aplicada' THEN
    RAISE EXCEPTION 'BUG-05 REGRESIÓN: no se permitió Timbrada -> Aplicada con uuid_fiscal presente';
  END IF;

  -- CASO 3 (control adicional): NC nueva directo a 'Aplicada' en INSERT sin uuid_fiscal -> también debe rechazarse.
  BEGIN
    INSERT INTO public.factura_notas_credito
      (organization_id, factura_id, folio, motivo, descripcion, monto, moneda, estado)
    VALUES
      (v_org, v_fac, 'NC-UUID-002', 'Otro', 'Prueba BUG-05 insert directo', 200, 'MXN', 'Aplicada')
    RETURNING id INTO v_nc2;
    v_state := '00000';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
  END;

  IF v_state <> '22023' OR v_msg NOT LIKE 'LC_NC_UUID_REQUERIDO%' THEN
    RAISE EXCEPTION 'BUG-05 REGRESIÓN: se esperaba rechazo en INSERT directo a Aplicada sin uuid_fiscal, vino % / %', v_state, v_msg;
  END IF;

  RAISE NOTICE 'OK: guard_nc_cliente_transicion exige uuid_fiscal para Aplicada y permite la transición con uuid_fiscal.';
END $$;

ROLLBACK;
