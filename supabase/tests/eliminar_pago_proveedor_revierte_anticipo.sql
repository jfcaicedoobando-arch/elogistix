-- BUG-07 (auditoría 2026-08-18) · eliminar_pago_proveedor revierte anticipo.
-- Verifica que al eliminar un pago que aplicó un anticipo, en la MISMA
-- transacción se revierta la aplicación (anticipos_aplicaciones.deleted_at),
-- el saldo/estado del anticipo se recalculen y la factura vuelva a 'Vigente'.
DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cat uuid;
  v_prov uuid;
  v_pf uuid;
  v_ant uuid;
  v_pago uuid;
  v_resultado jsonb;
  v_estado_factura text;
  v_saldo_ant numeric;
  v_estado_ant text;
  v_aa_deleted timestamptz;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST ANTICIPO REV', 'TAR000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'anticipo-rev@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'tesorero'::public.app_role) ON CONFLICT DO NOTHING;
  -- es_escritor_financiero() consulta user_roles, no organization_members.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'tesorero'::public.app_role) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
  VALUES (v_org, 'Costo directo TEST ANTREV', 1, true) RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR ANTICIPO REV', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.anticipos_proveedor (
    organization_id, proveedor_id, fecha_anticipo, monto, moneda, saldo_disponible, estado
  ) VALUES (v_org, v_prov, current_date, 1000, 'MXN'::public.moneda, 1000, 'disponible')
  RETURNING id INTO v_ant;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-ANTREV01', v_cat, 'FP-ANTREV01', 1000, 1000,
    'MXN'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  INSERT INTO public.pagos_proveedor (
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
    monto_en_moneda_factura, es_anticipo_aplicado
  ) VALUES (v_org, v_pf, current_date, 1000, 'MXN'::public.moneda, 1000, true)
  RETURNING id INTO v_pago;

  INSERT INTO public.anticipos_aplicaciones (
    organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
    monto_aplicado, moneda_aplicada
  ) VALUES (v_org, v_ant, v_pf, v_pago, 1000, 'MXN'::public.moneda);

  -- Precondición: el pago dejó la factura en 'Pagada' y el anticipo agotado.
  SELECT estado::text INTO v_estado_factura FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado_factura <> 'Pagada' THEN
    RAISE EXCEPTION 'BUG-07 SETUP FAIL: la factura no quedó Pagada tras el pago (estado=%)', v_estado_factura;
  END IF;
  SELECT saldo_disponible, estado INTO v_saldo_ant, v_estado_ant
    FROM public.anticipos_proveedor WHERE id = v_ant;
  IF v_saldo_ant <> 0 OR v_estado_ant <> 'aplicado_total' THEN
    RAISE EXCEPTION 'BUG-07 SETUP FAIL: el anticipo no quedó agotado (saldo=%, estado=%)', v_saldo_ant, v_estado_ant;
  END IF;

  ----------------------------------------------------------------------------
  -- Acción: eliminar el pago.
  ----------------------------------------------------------------------------
  v_resultado := public.eliminar_pago_proveedor(v_pago, 'Prueba BUG-07');

  IF (v_resultado ->> 'anticipos_revertidos')::int <> 1 THEN
    RAISE EXCEPTION 'BUG-07 FAIL: el resultado no reporta la reversion del anticipo (%)', v_resultado;
  END IF;

  SELECT deleted_at INTO v_aa_deleted FROM public.anticipos_aplicaciones
   WHERE pago_proveedor_id = v_pago;
  IF v_aa_deleted IS NULL THEN
    RAISE EXCEPTION 'BUG-07 FAIL: la aplicación del anticipo no se revirtió (deleted_at es NULL)';
  END IF;

  SELECT saldo_disponible, estado INTO v_saldo_ant, v_estado_ant
    FROM public.anticipos_proveedor WHERE id = v_ant;
  IF v_saldo_ant <> 1000 OR v_estado_ant <> 'disponible' THEN
    RAISE EXCEPTION 'BUG-07 FAIL: el saldo del anticipo no se liberó (saldo=%, estado=%)', v_saldo_ant, v_estado_ant;
  END IF;

  SELECT estado::text INTO v_estado_factura FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado_factura <> 'Vigente' THEN
    RAISE EXCEPTION 'BUG-07 FAIL: la factura no revirtió su estado tras eliminar el pago (estado=%)', v_estado_factura;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.anticipos_aplicaciones WHERE organization_id = v_org;
  DELETE FROM public.pagos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.anticipos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.presupuesto_categorias WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  DELETE FROM public.bitacora_actividad WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;
  DELETE FROM public.user_roles WHERE user_id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;

  RAISE NOTICE 'OK: eliminar_pago_proveedor revierte el anticipo y el estado de la factura (BUG-07).';
END $$;
