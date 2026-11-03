-- v13.497.1 · Pagos a proveedor en embarques Cerrados.
-- Verifica: (1) se puede registrar un pago aunque el embarque esté Cerrado y el
-- concepto de costo queda marcado como Pagado; (2) el candado sigue bloqueando
-- la edición manual de importes en conceptos_costo de un embarque Cerrado.
-- El fixture completo se revierte; su limpieza no puede borrar un cerrado.
BEGIN;
DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_cat uuid;
  v_prov uuid;
  v_pf uuid;
  v_cc uuid;
  v_liq text;
  v_bloqueado boolean := false;
  v_baja_bloqueada boolean := false;
  v_mensaje text;
  v_before jsonb;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST PAGO CERRADO', 'TPC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  -- Sesión simulada (se activa más abajo): el trigger de demoras al pasar a
  -- 'Entregado' exige que auth.uid() sea miembro de la org, si no lanza
  -- 'No autorizado'. Se siembra el usuario aquí, pero los claims se fijan
  -- justo antes de las transiciones para no disparar guards de alta.
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'pago-cerrado@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org') ON CONFLICT DO NOTHING;




  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE PAGO CERRADO', '', 'cxp-pago-cerrado@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELIMP09911', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.conceptos_costo (organization_id, embarque_id, concepto, monto, moneda, origen)
  VALUES (v_org, v_emb, 'Flete Internacional', 1000, 'USD'::public.moneda, 'manual')
  RETURNING id INTO v_cc;

  SELECT id INTO v_cat FROM public.presupuesto_categorias
   WHERE organization_id = v_org ORDER BY orden LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
    VALUES (v_org, 'Costo directo TEST', 1, true) RETURNING id INTO v_cat;
  END IF;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR PAGO CERRADO', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, fecha_emision, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-9911', v_cat, 'FP-999911', v_emb, public.fecha_negocio_mx(), 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Flete Internacional', 1, 1000);

  -- Aprobar el fixture despues de vincular conceptos, antes de cerrar y pagar.
  PERFORM set_config('app.aprobando_cxp', '1', true);
  UPDATE public.proveedor_facturas
  SET estado_aprobacion = 'aprobada', aprobada_at = now()
  WHERE id = v_pf;
  PERFORM set_config('app.aprobando_cxp', '0', true);

  -- Cerramos el embarque recorriendo la cadena de transiciones válidas
  -- (Confirmado → En Tránsito → Arribo → En Aduana → Entregado → Cerrado).
  -- El bypass de cierre sólo evita el guard de self-update, no el de transición.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.embarques SET estado = 'En Tránsito'::public.estado_embarque WHERE id = v_emb;
  UPDATE public.embarques SET estado = 'Arribo'::public.estado_embarque WHERE id = v_emb;
  UPDATE public.embarques SET estado = 'En Aduana'::public.estado_embarque WHERE id = v_emb;
  UPDATE public.embarques SET estado = 'Entregado'::public.estado_embarque WHERE id = v_emb;
  UPDATE public.embarques SET estado = 'Cerrado'::public.estado_embarque WHERE id = v_emb;
  PERFORM set_config('app.bypass_cierre', 'off', true);

  ----------------------------------------------------------------------------
  -- Caso 1: el pago se registra y el concepto queda Pagado
  ----------------------------------------------------------------------------
  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_org, v_pf, public.fecha_negocio_mx(), 1000, 'USD'::public.moneda);

  SELECT estado_liquidacion::text INTO v_liq FROM public.conceptos_costo WHERE id = v_cc;
  IF v_liq <> 'Pagado' THEN
    RAISE EXCEPTION 'TEST FAIL: concepto quedó en % (esperaba Pagado) con embarque Cerrado', v_liq;
  END IF;

  ----------------------------------------------------------------------------
  -- Caso 2: la edición manual de importes sigue bloqueada
  ----------------------------------------------------------------------------
  BEGIN
    UPDATE public.conceptos_costo SET monto = 2000 WHERE id = v_cc;
  EXCEPTION WHEN OTHERS THEN
    v_bloqueado := true;
  END;

  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'TEST FAIL: se permitió editar el monto de un concepto en embarque Cerrado';
  END IF;

  ----------------------------------------------------------------------------
  -- Caso 3: H14 impide borrar el cerrado y conserva toda la relación de pago.
  -- No se habilita ningún bypass para limpiar el fixture: lo revierte ROLLBACK.
  SELECT jsonb_build_object(
    'embarque', (SELECT to_jsonb(e) FROM public.embarques e WHERE id = v_emb),
    'concepto', (SELECT to_jsonb(c) FROM public.conceptos_costo c WHERE id = v_cc),
    'factura', (SELECT to_jsonb(f) FROM public.proveedor_facturas f WHERE id = v_pf),
    'vinculos', (SELECT jsonb_agg(to_jsonb(c) ORDER BY id)
      FROM public.proveedor_facturas_conceptos c WHERE proveedor_factura_id = v_pf),
    'pagos', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id)
      FROM public.pagos_proveedor p WHERE organization_id = v_org)) INTO v_before;
  BEGIN
    DELETE FROM public.embarques WHERE id = v_emb;
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS v_mensaje = MESSAGE_TEXT;
    IF position('LC_EMBARQUE_BLOQUEADO:' IN v_mensaje) <> 1 THEN RAISE; END IF;
    v_baja_bloqueada := true;
  END;
  IF NOT v_baja_bloqueada THEN
    RAISE EXCEPTION 'TEST FAIL: H14 permitió borrar el embarque Cerrado';
  END IF;
  IF jsonb_build_object(
    'embarque', (SELECT to_jsonb(e) FROM public.embarques e WHERE id = v_emb),
    'concepto', (SELECT to_jsonb(c) FROM public.conceptos_costo c WHERE id = v_cc),
    'factura', (SELECT to_jsonb(f) FROM public.proveedor_facturas f WHERE id = v_pf),
    'vinculos', (SELECT jsonb_agg(to_jsonb(c) ORDER BY id)
      FROM public.proveedor_facturas_conceptos c WHERE proveedor_factura_id = v_pf),
    'pagos', (SELECT jsonb_agg(to_jsonb(p) ORDER BY id)
      FROM public.pagos_proveedor p WHERE organization_id = v_org)) IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'TEST FAIL: la baja rechazada alteró el embarque o su historia de pago';
  END IF;

  RAISE NOTICE 'OK: pagos a proveedor permitidos en embarques Cerrados.';
END $$;
ROLLBACK;
