-- N-BL-01: validar_cierre_embarque debe convertir el pagado CxP a la moneda de
-- la factura. Casos:
--   1) Regresión: factura 500 USD "pagada" con 500 MXN @19 -> cxp_pagada.ok=false.
--   2) Fail-closed: pago 9500 MXN SIN tipo de cambio -> se excluye del pagado,
--      pagos_sin_tipo_cambio=1 y el cierre sigue bloqueado.
--   3) Control positivo: pago 9500 MXN @19 (= 500 USD) -> cxp_pagada.ok=true.
DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_cat uuid;
  v_prov uuid;
  v_pf uuid;
  v_pago uuid;
  v_check jsonb;
  v_moneda jsonb;
  v_saldo numeric;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CIERRE CONVERSION', 'TCC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid, 'cierre-conversion@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CIERRE CONVERSION', '', 'cierre.conversion@test.local') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELCCX00001', 'Aéreo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
  VALUES (v_org, 'Costo directo TEST CIERRE CONVERSION', 1, true) RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR CIERRE CONVERSION', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, embarque_id, folio_proveedor, categoria_presupuesto_id,
    subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, v_emb, 'A-CC-USD01', v_cat, 500, 500,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf;

  -- Caso 1: pago de 500 MXN con TC 19 => 26.32 USD, no cubre los 500 USD.
  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, monto, moneda, tipo_cambio_usd)
  VALUES (v_org, v_pf, 500, 'MXN'::public.moneda, 19)
  RETURNING id INTO v_pago;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb)->'checks') c
   WHERE c->>'regla' = 'cxp_pagada';
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF (v_check->>'ok')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL caso 1: cxp_pagada.ok debía ser false (pago 500 MXN vs factura 500 USD): %', v_check;
  END IF;

  SELECT m INTO v_moneda FROM jsonb_array_elements(v_check->'detalle'->'por_moneda') m
   WHERE m->>'moneda' = 'USD';
  v_saldo := (v_moneda->>'saldo')::numeric;
  IF v_saldo < 473 OR v_saldo > 474 THEN
    RAISE EXCEPTION 'FAIL caso 1: saldo USD esperado ~473.68, obtenido % (%)', v_saldo, v_moneda;
  END IF;
  RAISE NOTICE '✓ caso 1: saldo USD % con pago en MXN convertido', v_saldo;

  -- Caso 2: la base ya no permite dejar un pago en otra moneda sin TC
  -- (guard LC_PAGO_TC_REQUERIDO). El escenario "pago sin TC" es hoy
  -- inalcanzable: verificamos que el guard lo rechaza.
  DECLARE
    v_state text;
    v_msg text;
  BEGIN
    BEGIN
      UPDATE public.pagos_proveedor SET monto = 9500, tipo_cambio_usd = NULL WHERE id = v_pago;
      v_state := '00000';
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    END;
    IF v_state = '00000' OR COALESCE(v_msg, '') NOT LIKE 'LC_PAGO_TC_REQUERIDO%' THEN
      RAISE EXCEPTION 'FAIL caso 2: se esperaba LC_PAGO_TC_REQUERIDO al dejar el pago sin TC, vino % / %', v_state, v_msg;
    END IF;
    RAISE NOTICE '✓ caso 2: la base bloquea pagos en otra moneda sin tipo de cambio (%)', v_msg;
  END;

  -- Caso 3: pago de 9500 MXN con TC 19 = 500 USD => cubre la factura.
  UPDATE public.pagos_proveedor SET monto = 9500, tipo_cambio_usd = 19 WHERE id = v_pago;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  SELECT c INTO v_check
    FROM jsonb_array_elements(public.validar_cierre_embarque(v_emb)->'checks') c
   WHERE c->>'regla' = 'cxp_pagada';
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF (v_check->>'ok')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL caso 3: pago equivalente en MXN debía saldar la factura USD: %', v_check;
  END IF;
  RAISE NOTICE '✓ caso 3: pago 9500 MXN @19 salda la factura de 500 USD';

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

  RAISE NOTICE 'validar_cierre_cxp_conversion_moneda: PASS';
END $$;
