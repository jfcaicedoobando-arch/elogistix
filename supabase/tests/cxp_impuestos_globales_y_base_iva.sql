-- AUD-F03/F04. Fixtures aislados; no modifica facturas existentes.
BEGIN;
DO $t$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_prov uuid;
  v_cat uuid;
  v_pf uuid;
  v_f public.proveedor_facturas;
  v_rechazo boolean;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST CXP IMPUESTOS GLOBALES', 'TIG000000XX0', 'basico', true) RETURNING id INTO v_org;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'cxp-impuestos@test.local');
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role);
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_org, 'Administracion TEST IEPS', 1, true, 'Administracion') RETURNING id INTO v_cat;
  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR TEST IEPS', 'Logistico'::public.categoria_proveedor,
    'Naviera'::public.tipo_proveedor) RETURNING id INTO v_prov;
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
     subtotal, iva, ieps, total, moneda, fecha_emision, estado, estado_aprobacion)
  VALUES (v_org, v_prov, 'TEST-GLOBAL-IEPS', v_cat, 1000, 172.8, 80, 1252.8,
    'MXN'::public.moneda, CURRENT_DATE, 'Vigente'::public.estado_proveedor_factura, 'pendiente')
  RETURNING id INTO v_pf;
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, descripcion, cantidad, monto, iva, ieps)
  VALUES (v_org, v_pf, 'Maniobras', 1, 1000, 172.8, 0);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- El token revisado conserva el contrato: descripción no modifica IEPS, total ni deuda.
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf,
    '[{"descripcion":"Maniobras corregidas","monto":1000,"cantidad":1,"iva":172.8,"ieps":0}]',
    NULL, (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf));
  SELECT * INTO v_f FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_f.subtotal <> 1000 OR v_f.iva <> 172.8 OR v_f.ieps <> 80 OR v_f.total <> 1252.8 THEN
    RAISE EXCEPTION 'FAIL descripción perdió impuestos/total: %', row_to_json(v_f);
  END IF;
  PERFORM public._cxp_validar_aprobacion(v_pf, 'Gasto administrativo de prueba');

  -- Cliente nuevo: distribuir el IEPS explícitamente sin duplicar el global.
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf,
    '[{"descripcion":"Maniobras","monto":1000,"cantidad":1,"iva":172.8,"ieps":80}]',
    '{"iva":0,"ieps":0}', (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf));
  SELECT * INTO v_f FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_f.ieps <> 80 OR v_f.total <> 1252.8 THEN RAISE EXCEPTION 'FAIL distribución duplicó impuesto'; END IF;

  -- Impuestos son importes del renglón: cantidad 2 no vuelve a multiplicarlos.
  PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf,
    '[{"descripcion":"Maniobras","monto":1000,"cantidad":2,"iva":345.6,"ieps":160}]',
    '{"iva":0,"ieps":0}', (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf));
  SELECT * INTO v_f FROM public.proveedor_facturas WHERE id = v_pf;
  IF v_f.subtotal <> 2000 OR v_f.iva <> 345.6 OR v_f.ieps <> 160 OR v_f.total <> 2505.6 THEN
    RAISE EXCEPTION 'FAIL cantidad/importe fiscal incorrecto';
  END IF;
  PERFORM public._cxp_validar_aprobacion(v_pf, 'Gasto administrativo de prueba');

  -- Sigue bloqueando IVA realmente excesivo (base 2160, máximo 345.62).
  UPDATE public.proveedor_facturas SET iva = 400 WHERE id = v_pf;
  v_rechazo := false;
  BEGIN
    PERFORM public._cxp_validar_aprobacion(v_pf, 'Gasto administrativo de prueba');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LC_CXP_IVA_IMPLAUSIBLE:%' THEN RAISE; END IF;
    v_rechazo := true;
  END;
  IF NOT v_rechazo THEN RAISE EXCEPTION 'FAIL aprobación aceptó IVA excesivo'; END IF;
  UPDATE public.proveedor_facturas SET iva = 345.6 WHERE id = v_pf;

  -- Payload incompleto/negativo rechazado atómicamente, sin borrar partidas.
  v_rechazo := false;
  BEGIN
    PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf, '[]', '{"iva":0,"ieps":-80}',
      (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf));
  EXCEPTION WHEN SQLSTATE '22023' THEN v_rechazo := true;
  END;
  IF NOT v_rechazo OR (SELECT COUNT(*) FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = v_pf) <> 1 THEN
    RAISE EXCEPTION 'FAIL rechazo no fue atómico';
  END IF;

  -- Los guardas fiscales anteriores siguen vigentes.
  UPDATE public.proveedor_facturas SET uuid_fiscal = gen_random_uuid()::text WHERE id = v_pf;
  v_rechazo := false;
  BEGIN
    PERFORM public.reemplazar_conceptos_factura_proveedor(v_pf, '[]', '{"iva":0,"ieps":0}',
      (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf));
  EXCEPTION WHEN SQLSTATE '22023' THEN
    IF SQLERRM NOT LIKE 'LC_CONCEPTOS_FISCALES:%' THEN RAISE; END IF;
    v_rechazo := true;
  END;
  IF NOT v_rechazo THEN RAISE EXCEPTION 'FAIL permitió editar CFDI fiscal'; END IF;
  RAISE NOTICE '✓ CxP IEPS global conservado, distribución explícita y base IVA en paridad';
END;
$t$;
ROLLBACK;
