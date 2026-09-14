-- =============================================================
-- pfc_lectura_operativa_embarque.sql · v13.823.394 (B1)
--
-- `coordinador_logistico` / `gerente_operaciones` veían la conciliación del
-- expediente en 0 / "Sin factura": la única policy permisiva de
-- `proveedor_facturas_conceptos` era de finanzas, así que RLS filtraba TODOS los
-- vínculos factura↔concepto sin lanzar error (falso negativo).
--
--   · CASO 1 (positivo): el coordinador ve el vínculo del concepto de costo de
--     un embarque de SU organización, y la factura vinculada vía el embed.
--   · CASO 2 (negativo P0): no ve los vínculos de OTRA organización.
--   · CASO 3 (sólo lectura): INSERT / UPDATE / DELETE siguen bloqueados.
--   · CASO 4 (sin aprobación ni pago): las RPC de aprobar y pagar siguen
--     negando al coordinador.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/pfc_lectura_operativa_embarque.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org   uuid;
  v_org2  uuid;
  v_uid   uuid := gen_random_uuid();
  v_cli   uuid;
  v_cli2  uuid;
  v_emb   uuid;
  v_emb2  uuid;
  v_cat   uuid;
  v_cat2  uuid;
  v_prov  uuid;
  v_prov2 uuid;
  v_pf    uuid;
  v_pf2   uuid;
  v_cc    uuid;
  v_cc2   uuid;
  v_pfc   uuid;
  v_visto integer;
  v_rows  integer;
  v_ok    boolean;
BEGIN
  ------------------------------------------------------------------ organizaciones
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST PFC OPERATIVO', 'TPO000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST PFC OPERATIVO AJENA', 'TPO000000XX1', 'basico', true)
  RETURNING id INTO v_org2;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'coord-pfc@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;

  ------------------------------------------------------------------ expedientes
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE PFC', '', 'cli-pfc@test.mx') RETURNING id INTO v_cli;
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org2, 'CLIENTE PFC AJENO', '', 'cli-pfc-ajeno@test.mx') RETURNING id INTO v_cli2;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org, v_cli, 'ELIMP09801', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb;
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_org2, v_cli2, 'ELIMP09802', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion)
  RETURNING id INTO v_emb2;

  INSERT INTO public.conceptos_costo (organization_id, embarque_id, concepto, monto, moneda)
  VALUES (v_org, v_emb, 'Cargos en Destino', 1000, 'USD'::public.moneda)
  RETURNING id INTO v_cc;
  INSERT INTO public.conceptos_costo (organization_id, embarque_id, concepto, monto, moneda)
  VALUES (v_org2, v_emb2, 'Cargos en Destino ajeno', 900, 'USD'::public.moneda)
  RETURNING id INTO v_cc2;

  SELECT id INTO v_cat FROM public.presupuesto_categorias
   WHERE organization_id = v_org ORDER BY orden LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
    VALUES (v_org, 'Costo directo TEST', 1, true) RETURNING id INTO v_cat;
  END IF;
  SELECT id INTO v_cat2 FROM public.presupuesto_categorias
   WHERE organization_id = v_org2 ORDER BY orden LIMIT 1;
  IF v_cat2 IS NULL THEN
    INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
    VALUES (v_org2, 'Costo directo TEST', 1, true) RETURNING id INTO v_cat2;
  END IF;

  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org, 'PROVEEDOR PFC', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov;
  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
  VALUES (v_org2, 'PROVEEDOR PFC AJENO', 'Logistico'::public.categoria_proveedor,
          'Naviera'::public.tipo_proveedor)
  RETURNING id INTO v_prov2;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org, v_prov, 'A-9801', v_cat, 'FP-999801', v_emb, 1000, 1000,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'pendiente'
  ) RETURNING id INTO v_pf;

  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
    folio_interno, embarque_id, subtotal, total, moneda, estado, estado_aprobacion
  ) VALUES (
    v_org2, v_prov2, 'A-9802', v_cat2, 'FP-999802', v_emb2, 900, 900,
    'USD'::public.moneda, 'Vigente'::public.estado_proveedor_factura, 'pendiente'
  ) RETURNING id INTO v_pf2;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org, v_pf, v_cc, 'Cargos en Destino', 1, 1000)
  RETURNING id INTO v_pfc;

  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
  VALUES (v_org2, v_pf2, v_cc2, 'Cargos en Destino ajeno', 1, 900);

  ------------------------------------------------------------------ como coordinador
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  SET LOCAL ROLE authenticated;

  -- CASO 1 · lectura operativa permitida
  SELECT count(*) INTO v_visto
    FROM public.proveedor_facturas_conceptos
   WHERE concepto_costo_id = v_cc;
  IF v_visto <> 1 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el coordinador vio % vínculos (se esperaba 1)', v_visto;
  END IF;

  SELECT count(*) INTO v_visto
    FROM public.proveedor_facturas WHERE id = v_pf AND deleted_at IS NULL;
  IF v_visto <> 1 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: no ve la factura vinculada del expediente';
  END IF;
  RAISE NOTICE 'CASO 1 OK: ve el vínculo y la factura de su propio embarque';

  -- CASO 2 · aislamiento por organización
  SELECT count(*) INTO v_visto
    FROM public.proveedor_facturas_conceptos
   WHERE concepto_costo_id = v_cc2;
  IF v_visto <> 0 THEN
    RAISE EXCEPTION 'REGRESION P0: vio % vínculos de otra organización', v_visto;
  END IF;
  RAISE NOTICE 'CASO 2 OK: los vínculos de otra organización siguen ocultos';

  -- CASO 3 · sigue siendo SÓLO LECTURA
  -- Intentamos INSERT; cualquier rechazo (RLS o guard de negocio) es resultado válido.
  v_ok := false;
  BEGIN
    INSERT INTO public.proveedor_facturas_conceptos
      (organization_id, proveedor_factura_id, concepto_costo_id, descripcion, cantidad, monto)
    VALUES (v_org, v_pf, v_cc, 'Alta indebida', 1, 1);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_ok := true; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el coordinador pudo INSERTAR un vínculo';
  END IF;

  -- Intentamos UPDATE.
  v_ok := false;
  BEGIN
    UPDATE public.proveedor_facturas_conceptos SET monto = 2 WHERE id = v_pfc;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_ok := true; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el coordinador pudo ACTUALIZAR un vínculo';
  END IF;

  -- Intentamos DELETE.
  v_ok := false;
  BEGIN
    DELETE FROM public.proveedor_facturas_conceptos WHERE id = v_pfc;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_ok := true; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el coordinador pudo BORRAR un vínculo';
  END IF;
  RAISE NOTICE 'CASO 3 OK: sin escritura sobre los vínculos';

  -- CASO 4 · sin aprobación ni pago
  -- La aprobación y el pago pueden fallar por permiso (RLS) o por un guard
  -- de negocio anterior; ambos son aceptables. Sólo falla la prueba si
  -- la operación llega a ejecutarse con éxito.
  v_ok := false;
  BEGIN
    PERFORM public.aprobar_factura_proveedor(v_pf, true, NULL);
    v_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: el coordinador pudo APROBAR la factura';
  END IF;

  v_ok := false;
  BEGIN
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, fecha_pago, monto, moneda)
    VALUES (v_org, v_pf, current_date, 100, 'USD'::public.moneda);
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN v_ok := true; END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ok := false;
  END;
  IF v_ok THEN
    RAISE EXCEPTION 'CASO 4 FALLÓ: el coordinador pudo registrar un PAGO';
  END IF;
  RAISE NOTICE 'CASO 4 OK: sin aprobación ni pago';

  RESET ROLE;
END;
$$;

ROLLBACK;
