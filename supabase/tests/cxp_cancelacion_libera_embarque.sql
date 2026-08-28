-- v13.505.0 · Cancelación de factura de proveedor: libera embarque y conceptos.
-- Verifica que `cancelar_factura_proveedor` haga lo mismo que el rechazo:
-- borra los vínculos con conceptos_costo, suelta el embarque y libera el
-- documento del buzón (antes la factura cancelada quedaba pegada al expediente).
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
  v_n integer;
  v_estado text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CANCELA CXP', 'TCC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  -- Sesión simulada: cancelar_factura_proveedor exige is_org_member().
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'cancela-cxp@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org') ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE CANCELA', '', 'cxp-cancela@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELIMP09921', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;

  INSERT INTO public.conceptos_costo (organization_id, embarque_id, concepto, monto, moneda, origen)
  VALUES (v_org, v_emb, 'Cargos en Destino', 1000, 'USD'::public.moneda, 'manual')
  RETURNING id INTO v_cc;

  SELECT id INTO v_cat FROM public.presupuesto_categorias
   WHERE organization_id = v_org ORDER BY orden LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
    VALUES (v_org, 'Costo directo TEST', 1, true) RETURNING id INTO v_cat;
  END IF;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR CANCELA', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-9921', v_cat, 'FP-999921', v_emb, 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'aprobada'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Cargos en Destino', 1, 1000);

  INSERT INTO public.embarque_facturas_entrantes
    (organization_id, embarque_id, proveedor_factura_id, estado, archivo_path, archivo_hash, nombre_archivo)
  VALUES (v_org, v_emb, v_pf, 'capturada', 'test/cancela.xml', 'hash-cancela-9921', 'cancela.xml');

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  PERFORM public.cancelar_factura_proveedor(v_pf, 'Cancelada ante el SAT');

  SELECT count(*) INTO v_n FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = v_pf;
  IF v_n <> 0 THEN
    RAISE EXCEPTION 'TEST FAIL: quedaron % vinculos tras la cancelacion', v_n;
  END IF;

  IF EXISTS (SELECT 1 FROM public.proveedor_facturas WHERE id = v_pf AND embarque_id IS NOT NULL) THEN
    RAISE EXCEPTION 'TEST FAIL: la factura cancelada sigue vinculada al embarque';
  END IF;

  SELECT estado::text INTO v_estado FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_estado <> 'Cancelada' THEN
    RAISE EXCEPTION 'TEST FAIL: la factura quedó en estado % (esperaba Cancelada)', v_estado;
  END IF;

  SELECT estado INTO v_estado FROM public.embarque_facturas_entrantes
   WHERE organization_id = v_org AND archivo_hash = 'hash-cancela-9921';
  IF v_estado <> 'rechazada' THEN
    RAISE EXCEPTION 'TEST FAIL: el documento del buzón quedó en % (esperaba rechazada)', v_estado;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.conceptos_costo WHERE id = v_cc AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'TEST FAIL: el concepto de costo original no debe borrarse';
  END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);

  DELETE FROM public.embarque_facturas_entrantes WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas_conceptos WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.conceptos_costo WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  DELETE FROM public.presupuesto_categorias WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.organization_members WHERE organization_id = v_org;
  -- La cancelación y los triggers de limpieza registran actividad para esta org.
  -- Se borra al final para no dejar nuevas referencias antes de eliminar el tenant.
  DELETE FROM public.bitacora_actividad WHERE organization_id = v_org;
  DELETE FROM public.organizations WHERE id = v_org;
  DELETE FROM auth.users WHERE id = v_uid;

  RAISE NOTICE 'OK: cancelar factura de proveedor libera embarque y conceptos.';
END $$;
