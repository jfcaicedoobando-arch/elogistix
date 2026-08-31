-- BUG-13: validar_cierre_embarque evalúa el umbral 0.01 de cxp_pagada POR
-- moneda. Con una factura de proveedor USD con saldo pendiente y una
-- situación MXN saldada, el check debe venir ok=false y detalle.por_moneda
-- debe incluir la moneda con saldo (USD).
DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_cat uuid;
  v_prov uuid;
  v_pf_usd uuid;
  v_pf_mxn uuid;
  v_resultado jsonb;
  v_check jsonb;
  v_ok boolean;
  v_por_moneda jsonb;
  v_encontro_usd boolean := false;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CIERRE MONEDA', 'TCM000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'cierre-moneda@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CIERRE MONEDA', '', 'cierre.moneda@test.local') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELCMX00001', 'Aéreo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
  VALUES (v_org, 'Costo directo TEST CIERRE MONEDA', 1, true) RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR CIERRE MONEDA', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  -- Factura USD con saldo pendiente (sin pagos).
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, embarque_id, folio_proveedor, categoria_presupuesto_id,
    subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, v_emb, 'A-CM-USD01', v_cat, 500, 500,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf_usd;

  -- Factura MXN saldada por completo (pago = total).
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, embarque_id, folio_proveedor, categoria_presupuesto_id,
    subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, v_emb, 'A-CM-MXN01', v_cat, 2000, 2000,
    'MXN'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf_mxn;

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
  VALUES (v_org, v_pf_mxn, 2000, 'MXN'::public.moneda, NULL);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  v_resultado := public.validar_cierre_embarque(v_emb);
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT c INTO v_check FROM jsonb_array_elements(v_resultado->'checks') c
   WHERE c->>'regla' = 'cxp_pagada';

  IF v_check IS NULL THEN
    RAISE EXCEPTION 'FAIL: no se encontró el check cxp_pagada en el resultado';
  END IF;

  v_ok := (v_check->>'ok')::boolean;
  v_por_moneda := v_check->'detalle'->'por_moneda';

  IF v_ok IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: cxp_pagada.ok=% (esperaba false) con USD pendiente y MXN saldada', v_ok;
  END IF;

  SELECT true INTO v_encontro_usd
  FROM jsonb_array_elements(v_por_moneda) m
  WHERE m->>'moneda' = 'USD' AND (m->>'saldo')::numeric > 0.01;

  IF NOT COALESCE(v_encontro_usd, false) THEN
    RAISE EXCEPTION 'FAIL: detalle.por_moneda no incluye USD con saldo pendiente (%)', v_por_moneda;
  END IF;

  RAISE NOTICE '✓ cxp_pagada.ok=false y por_moneda incluye USD con saldo: %', v_por_moneda;

  DELETE FROM public.pagos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.presupuesto_categorias WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;
  BEGIN
    DELETE FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RAISE NOTICE 'validar_cierre_umbral_por_moneda: PASS';
END $$;
