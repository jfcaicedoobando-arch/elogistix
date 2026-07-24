-- ============================================================================
-- Suite de pruebas de RLS — Tablas financieras críticas (Libre Carga)
-- ============================================================================
--
-- Cobertura: aislamiento multi-tenant en 9 tablas con riesgo regulatorio:
--   - cuentas_bancarias        (datos bancarios)
--   - bbva_movimientos         (estados de cuenta)
--   - proveedor_facturas       (CxP)
--   - pagos_factura            (CxC)
--   - pagos_proveedor          (CxP)
--   - cotizacion_costos        (markups/utilidad)
--   - factura_notas_credito    (notas de crédito)
--   - comisiones_devengadas    (comisiones vendedoras)
--   - liquidaciones_comision   (liquidaciones de comisión)
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_financiero_critico.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. Hace ROLLBACK al final.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql


DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  prov_a uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  cuenta_a uuid := gen_random_uuid();
  cuenta_b uuid := gen_random_uuid();
  pf_a uuid := gen_random_uuid();
  pf_b uuid := gen_random_uuid();
  pago_fac_a uuid := gen_random_uuid();
  pago_prov_a uuid := gen_random_uuid();
  nc_a uuid := gen_random_uuid();
  vend_a uuid := gen_random_uuid();
  liq_a uuid := gen_random_uuid();
  com_a uuid := gen_random_uuid();
  mov_a uuid := gen_random_uuid();
  cc_a uuid := gen_random_uuid();
  visible int;
BEGIN
  -- Seed mínimo (bypass RLS como rol postgres)
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS FIN-C A'), (org_b, 'RLS FIN-C B');
  INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
    VALUES (cli_a, 'CliFinC A', 'XAXX010101000', 'a@test.local', org_a), (cli_b, 'CliFinC B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm)
    VALUES
      (emb_a, 'ELFCR00001', cli_a, 'CliFinC A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
      (emb_b, 'ELFCR00002', cli_b, 'CliFinC B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria)
    VALUES
      (prov_a, 'ProvFC A', org_a, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor),
      (prov_b, 'ProvFC B', org_b, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  -- Seed canonical presupuesto_categorias (categoria_presupuesto_id es NOT NULL).
  PERFORM public.seed_presupuesto_categorias(org_a);
  PERFORM public.seed_presupuesto_categorias(org_b);

  -- =========================================================================
  -- TEST 1: cuentas_bancarias aislamiento
  -- =========================================================================
  INSERT INTO public.cuentas_bancarias(
    id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, activa, notas
  ) VALUES
    (cuenta_a, org_a, 'BBVA', 'Op A', '0001', '012180000000000001', 'MXN', 0, true, ''),
    (cuenta_b, org_b, 'BBVA', 'Op B', '0002', '012180000000000002', 'MXN', 0, true, '');

  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM public.cuentas_bancarias;
  PERFORM pg_temp.assert(visible = 1, format('user_a debe ver 1 cuenta, vio %s', visible));
  SELECT count(*) INTO visible FROM public.cuentas_bancarias WHERE id = cuenta_b;
  PERFORM pg_temp.assert(visible = 0, 'user_a NO debe ver cuenta_bancaria de org_b');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 2: bbva_movimientos aislamiento
  -- =========================================================================
  INSERT INTO public.bbva_movimientos(
    id, organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, motivo_ignorar, importado_en
  ) VALUES (
    mov_a, org_a, cuenta_a, CURRENT_DATE, 'Depósito test', 'REF-001',
    0, 1000, 'hash-test-001', 'Pendiente', '', now()
  );

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.bbva_movimientos WHERE id = mov_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver bbva_movimientos de org_a');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 3: proveedor_facturas aislamiento
  -- =========================================================================
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor,
    fecha_emision, dias_credito, moneda, tipo_cambio_usd, subtotal, iva, retenciones, total, estado, notas,
    categoria_presupuesto_id
  ) VALUES
    (pf_a, org_a, prov_a, 'ProvFC A', emb_a, 'PV-A-001',
      CURRENT_DATE, 30, 'MXN', 1, 1000, 160, 0, 1160, 'Vigente', '',
      (SELECT id FROM public.presupuesto_categorias WHERE organization_id = org_a AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1)),
    (pf_b, org_b, prov_b, 'ProvFC B', emb_b, 'PV-B-001',
      CURRENT_DATE, 30, 'MXN', 1, 2000, 320, 0, 2320, 'Vigente', '',
      (SELECT id FROM public.presupuesto_categorias WHERE organization_id = org_b AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1));

  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM public.proveedor_facturas;
  PERFORM pg_temp.assert(visible = 1, format('user_a debe ver 1 factura proveedor, vio %s', visible));
  SELECT count(*) INTO visible FROM public.proveedor_facturas WHERE id = pf_b;
  PERFORM pg_temp.assert(visible = 0, 'user_a NO debe ver factura proveedor de org_b');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 4: cotizacion_costos aislamiento (markups internos)
  -- =========================================================================
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_a, org_a, cli_a, 'CliFinC A', 'COT-RLS-FC-A', 'Marítimo', 'Importación', 'FOB', 'Enviada');

  INSERT INTO public.cotizacion_costos(
    id, cotizacion_id, concepto, moneda, proveedor, cantidad, costo_unitario, precio_venta,
    unidad_medida, organization_id, notas
  ) VALUES (
    cc_a, cot_a, 'Flete', 'USD', 'ProvFC A', 1, 500, 800, 'BL', org_a, ''
  );

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.cotizacion_costos WHERE id = cc_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver cotizacion_costos de org_a');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 5: pagos_factura aislamiento
  -- (13.135.6) Guards `IF EXISTS facturas` eliminados: la tabla `facturas`
  -- es core y siempre existe en CI. El guard enmascaraba la cobertura.
  -- =========================================================================
  -- Factura timbrada: refleja el estado real en que una factura recibe pagos.
  -- Sin uuid_fiscal el trigger `trg_pago_factura_rep_viva` bloquearía cualquier
  -- REP; timbrarla aquí hace la fixture inmune al early-exit del guard.
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES (
    fac_a, org_a, cli_a, 'CliFinC A', emb_a, 'FA-FC-001',
    CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida',
    gen_random_uuid()::text, now()
  );

  INSERT INTO public.pagos_factura(
    id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn
  ) VALUES (
    pago_fac_a, fac_a, org_a, CURRENT_DATE, 500, 'MXN', 1,
    500, 'Transferencia', 'REF-PF-A', '', 0
  );

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.pagos_factura WHERE id = pago_fac_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver pagos_factura de org_a');
  PERFORM pg_temp.as_postgres();

  -- TEST 6: factura_notas_credito aislamiento
  INSERT INTO public.factura_notas_credito(
    id, organization_id, factura_id, folio, motivo, descripcion, monto, moneda,
    tipo_cambio, estado, fecha_emision
  ) VALUES (
    nc_a, org_a, fac_a, 'NC-A-001', 'Descuento', 'Ajuste', 100, 'MXN',
    1, 'Aplicada', CURRENT_DATE
  );

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.factura_notas_credito WHERE id = nc_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver nota de crédito de org_a');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 7: pagos_proveedor aislamiento
  -- =========================================================================
  -- v13.103.2: el trigger tg_pagos_proveedor_requiere_aprobacion exige factura aprobada.
  UPDATE public.proveedor_facturas
     SET estado_aprobacion = 'aprobada', aprobada_at = now()
   WHERE id = pf_a;

  INSERT INTO public.pagos_proveedor(
    id, organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
    metodo_pago, referencia, notas
  ) VALUES (
    pago_prov_a, org_a, pf_a, CURRENT_DATE, 500, 'MXN', NULL,
    'Transferencia', 'REF-PP-A', ''
  );

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.pagos_proveedor WHERE id = pago_prov_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver pagos_proveedor de org_a');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 8: comisiones_devengadas aislamiento
  -- (13.135.6) Guard `IF EXISTS` eliminado: la tabla la crea la migración
  -- 20260602193937. Si en CI no existe, queremos un fallo ruidoso.
  -- =========================================================================
  -- v13.309.49 — El trigger `trg_pago_factura_comision_ins` (restaurado en
  -- 13.309.43) inserta automáticamente una comisión devengada al crearse el
  -- pago_factura. Antes hacíamos un INSERT explícito que colisionaba con la
  -- unique key `comisiones_devengadas_pago_factura_id_key`. Ahora tomamos la
  -- fila auto-creada y ajustamos los campos necesarios para el test.
  SELECT id INTO com_a
    FROM public.comisiones_devengadas
   WHERE pago_factura_id = pago_fac_a;
  PERFORM pg_temp.assert(com_a IS NOT NULL, 'trigger debe crear comisiones_devengadas para el pago');
  UPDATE public.comisiones_devengadas
     SET embarque_id = emb_a,
         factura_id = fac_a,
         monto_cobrado_mxn = 500,
         utilidad_prorrateada_mxn = 200,
         porcentaje_aplicado = 0.10,
         comision_mxn = 20,
         estado = 'Devengada'
   WHERE id = com_a;

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.comisiones_devengadas WHERE id = com_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver comisiones_devengadas de org_a');
  PERFORM pg_temp.as_postgres();




  -- =========================================================================
  -- TEST 9: liquidaciones_comision aislamiento
  -- (13.135.6) Guards `IF EXISTS vendedoras / liquidaciones_comision` eliminados:
  -- `liquidaciones_comision` la crea la misma migración 20260602193937 y su
  -- columna `vendedora_id` es solo `uuid NOT NULL` sin FK, así que la tabla
  -- `vendedoras` (que nunca existió) no es necesaria.
  -- =========================================================================
  INSERT INTO public.liquidaciones_comision(
    id, organization_id, vendedora_id, periodo, total_mxn
  ) VALUES (liq_a, org_a, vend_a, '2026-01', 1000);

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.liquidaciones_comision WHERE id = liq_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver liquidaciones_comision de org_a');
  PERFORM pg_temp.as_postgres();


  -- =========================================================================
  -- TEST 10: WITH CHECK — bloquear INSERT cruzado de org desde user_b a org_a.
  -- Las pruebas 1-9 sólo validan SELECT; este bloque cubre el otro lado de la
  -- policy (mutaciones) para tablas financieras críticas. Si una policy tiene
  -- USING pero le falta WITH CHECK, este test lo detecta.
  -- =========================================================================
  PERFORM pg_temp.as_user(user_b);

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.cuentas_bancarias(organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, activa, notas)
       VALUES (%L, %L, %L, %L, %L, %L, 0, true, %L)',
      org_a, 'HACK', 'spoof', '9999', '012180000000009999', 'MXN', ''
    ),
    'cuentas_bancarias acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.proveedor_facturas(organization_id, proveedor_id, proveedor_nombre, embarque_id, folio_proveedor, fecha_emision, dias_credito, moneda, tipo_cambio_usd, subtotal, iva, retenciones, total, estado, notas, categoria_presupuesto_id)
       VALUES (%L, %L, %L, %L, %L, CURRENT_DATE, 30, %L, 0, 100, 16, 0, 116, %L, %L, %L)',
      org_a, prov_a, 'HACK', emb_a, 'HACK-001', 'MXN', 'Vigente', '',
      (SELECT id FROM public.presupuesto_categorias WHERE organization_id = org_a AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1)
    ),
    'proveedor_facturas acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.cotizacion_costos(cotizacion_id, concepto, moneda, proveedor, cantidad, costo_unitario, precio_venta, unidad_medida, organization_id, notas)
       VALUES (%L, %L, %L, %L, 1, 100, 200, %L, %L, %L)',
      cot_a, 'HACK', 'USD', 'spoof', 'BL', org_a, ''
    ),
    'cotizacion_costos acepta INSERT con organization_id ajeno'
  );

  -- (13.135.6) WITH CHECK ampliado: bbva_movimientos, pagos_factura,
  -- pagos_proveedor y factura_notas_credito. Antes solo se cubrían 3 tablas;
  -- estas 4 manejan dinero real y una policy sin WITH CHECK permitiría
  -- mutación cruzada de tenants sin detección.
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.bbva_movimientos(organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, hash_dedupe, estado_conciliacion, motivo_ignorar, importado_en)
       VALUES (%L, %L, CURRENT_DATE, %L, %L, 0, 1000, %L, %L, %L, now())',
      org_a, cuenta_a, 'HACK', 'REF-HACK', 'hash-hack-001', 'Pendiente', ''
    ),
    'bbva_movimientos acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.pagos_factura(factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio, monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn)
       VALUES (%L, %L, CURRENT_DATE, 1, %L, 1, 1, %L, %L, %L, 0)',
      fac_a, org_a, 'MXN', 'Transferencia', 'REF-HACK', ''
    ),
    'pagos_factura acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd, metodo_pago, referencia, notas)
       VALUES (%L, %L, CURRENT_DATE, 1, %L, 0, %L, %L, %L)',
      org_a, pf_a, 'MXN', 'Transferencia', 'REF-HACK', ''
    ),
    'pagos_proveedor acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, motivo, descripcion, monto, moneda, tipo_cambio, estado, fecha_emision)
       VALUES (%L, %L, %L, %L, %L, 1, %L, 1, %L, CURRENT_DATE)',
      org_a, fac_a, 'NC-HACK', 'Descuento', 'HACK', 'MXN', 'Aplicada'
    ),
    'factura_notas_credito acepta INSERT con organization_id ajeno'
  );

  PERFORM pg_temp.as_postgres();

  RAISE NOTICE 'RLS FIN CRITICO: 9 SELECTs + 7 WITH CHECK aserciones pasaron';
END;
$$;

ROLLBACK;
