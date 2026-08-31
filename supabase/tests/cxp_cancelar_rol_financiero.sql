-- BUG-06 (auditoría 2026-08-18) · guard_cxp_cancelacion_rol_financiero.
-- Verifica que sólo un rol financiero (rol_efectivo vía organization_members)
-- pueda cancelar una factura de proveedor; un rol no financiero de la MISMA
-- organización debe recibir LC_CXP_CANCELAR_FORBIDDEN (42501).
DO $$
DECLARE
  v_org uuid;
  v_uid_venta uuid := gen_random_uuid();
  v_uid_fin uuid := gen_random_uuid();
  v_cli uuid;
  v_cat uuid;
  v_prov uuid;
  v_pf uuid;
  v_estado text;
  v_sqlstate text;
  v_msg text;
  v_bloqueado boolean := false;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CXP ROL FIN', 'TCF000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  BEGIN
    INSERT INTO auth.users (id, email) VALUES (v_uid_venta, 'rolfin-venta@test.mx')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO auth.users (id, email) VALUES (v_uid_fin, 'rolfin-fin@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;

  -- Miembro de la org con rol NO financiero.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid_venta, 'vendedor'::public.app_role) ON CONFLICT DO NOTHING;
  -- Miembro de la MISMA org con rol financiero.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid_fin, 'contador'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE ROL FIN', '', 'cliente.rol.fin@test.local') RETURNING id INTO v_cli;

  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
  VALUES (v_org, 'Costo directo TEST ROLFIN', 1, true) RETURNING id INTO v_cat;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR ROL FIN', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-ROLFIN01', v_cat, 'FP-ROLFIN01', 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'pendiente'
  ) RETURNING id INTO v_pf;

  ----------------------------------------------------------------------------
  -- Caso 1: rol NO financiero (vendedor) intenta cancelar -> bloqueado.
  ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_venta)::text, true);
  BEGIN
    PERFORM public.cancelar_factura_proveedor(v_pf, 'Intento sin permiso');
    RAISE EXCEPTION 'BUG-06 FAIL: un rol no financiero pudo cancelar la factura de proveedor';
  EXCEPTION WHEN OTHERS THEN
    v_sqlstate := SQLSTATE; v_msg := SQLERRM;
    IF v_sqlstate <> '42501' OR v_msg NOT LIKE '%LC_CXP_CANCELAR_FORBIDDEN%' THEN
      RAISE;
    END IF;
    v_bloqueado := true;
  END;
  IF NOT v_bloqueado THEN
    RAISE EXCEPTION 'BUG-06 FAIL: no se detectó el bloqueo esperado';
  END IF;

  SELECT estado::text INTO v_estado FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado <> 'Vigente' THEN
    RAISE EXCEPTION 'BUG-06 FAIL: la factura cambió de estado (%) pese al bloqueo', v_estado;
  END IF;

  ----------------------------------------------------------------------------
  -- Caso 2: rol financiero (contador) de la misma org SÍ puede cancelar.
  ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid_fin)::text, true);
  PERFORM public.cancelar_factura_proveedor(v_pf, 'Cancelada por contador');

  SELECT estado::text INTO v_estado FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'BUG-06 FAIL: el rol financiero no pudo cancelar (estado=%)', v_estado;
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.presupuesto_categorias WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  DELETE FROM public.bitacora_actividad WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;
  BEGIN
    DELETE FROM auth.users WHERE id IN (v_uid_venta, v_uid_fin);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RAISE NOTICE 'OK: sólo un rol financiero puede cancelar una factura de proveedor (BUG-06).';
END $$;
