-- v13.493.0 · Rechazo de factura de proveedor: libera embarque y conceptos.
-- Verifica: (1) el rechazo borra vínculos, suelta el embarque, cancela la factura
-- y marca el archivo entrante como rechazado; (2) con pagos vivos se bloquea.
DO $$
DECLARE
  v_org uuid;
  v_cli uuid;
  v_emb uuid;
  v_cat uuid;
  v_prov uuid;
  v_pf uuid;
  v_cc uuid;
  v_res jsonb;
  v_n integer;
  v_estado text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST RECHAZO CXP', 'TRC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE RECHAZO', '', 'cxp-rechazo@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELIMP09901', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.conceptos_costo (organization_id, embarque_id, concepto, monto, moneda, origen)
  VALUES (v_org, v_emb, 'Cargos en Destino', 1000, 'USD'::public.moneda, 'manual')
  RETURNING id INTO v_cc;

  -- La organización ya nace con categorías de presupuesto por defecto.
  SELECT id INTO v_cat FROM public.presupuesto_categorias
   WHERE organization_id = v_org ORDER BY orden LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
    VALUES (v_org, 'Costo directo TEST', 1, true) RETURNING id INTO v_cat;
  END IF;


  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR RECHAZO', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-9901', v_cat, 'FP-999901', v_emb, 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'pendiente'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Cargos en Destino', 1, 1000);

  INSERT INTO public.embarque_facturas_entrantes
    (organization_id, embarque_id, proveedor_factura_id, estado, archivo_path, archivo_hash, nombre_archivo)
  VALUES (v_org, v_emb, v_pf, 'capturada', 'test/rechazo.xml', 'hash-rechazo-9901', 'rechazo.xml');

  ----------------------------------------------------------------------------
  -- Caso 1: rechazo libera todo
  ----------------------------------------------------------------------------
  v_res := public._cxp_desvincular_por_rechazo(v_pf, 'Monto no coincide');

  SELECT count(*) INTO v_n FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = v_pf;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: quedaron % vinculos tras el rechazo', v_n;
  END IF;

  SELECT estado::text INTO v_estado FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'TEST FAIL: la factura quedó en estado % (esperaba Cancelada)', v_estado;
  END IF;

  IF EXISTS (SELECT 1 FROM public.proveedor_facturas WHERE id = v_pf AND embarque_id IS NOT NULL) THEN
    RAISE EXCEPTION 'TEST FAIL: la factura sigue vinculada al embarque';
  END IF;

  SELECT estado INTO v_estado FROM public.embarque_facturas_entrantes WHERE proveedor_factura_id = v_pf;
  IF v_estado <> 'rechazada' THEN
    RAISE EXCEPTION 'TEST FAIL: el archivo entrante quedó en % (esperaba rechazada)', v_estado;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.conceptos_costo WHERE id = v_cc AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'TEST FAIL: el concepto de costo original no debe borrarse';
  END IF;

  ----------------------------------------------------------------------------
  -- Caso 2: con pagos vivos se bloquea
  ----------------------------------------------------------------------------
  -- La factura debe estar aprobada: el trigger tg_pagos_proveedor_requiere_aprobacion
  -- impide registrar pagos sobre facturas pendientes de aprobación.
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-9902', v_cat, 'FP-999902', v_emb, 500, 500,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
  VALUES (v_org, v_pf, current_date, 500, 'USD'::public.moneda);


  BEGIN
    PERFORM public._cxp_desvincular_por_rechazo(v_pf, 'Intento con pagos');
    RAISE EXCEPTION 'TEST FAIL: se permitió rechazar una factura con pagos aplicados';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  ----------------------------------------------------------------------------
  DELETE FROM public.pagos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.embarque_facturas_entrantes WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas_conceptos WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.conceptos_costo WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.presupuesto_categorias WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;

  RAISE NOTICE 'OK: rechazo de factura de proveedor libera embarque y conceptos.';
END $$;
