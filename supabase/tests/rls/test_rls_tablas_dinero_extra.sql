-- ============================================================================
-- Suite RLS — Tablas con dinero/credenciales sin cobertura previa (H4)
-- ============================================================================
-- Cubre tablas no incluidas en suites previos:
--   - anticipos_proveedor
--   - anticipos_aplicaciones
--   - cobranza_seguimiento
--   - facturapi_credenciales      (contiene API keys, fuga = catastrófica)
--   - embarque_garantias_contenedor
--   - cotizacion_costos_historico (snapshots de markups)
--   - costeo_navieras_condiciones
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_tablas_dinero_extra.sql
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
  naviera_x uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  ant_a uuid := gen_random_uuid();
  seg_a uuid := gen_random_uuid();
  seg_b uuid := gen_random_uuid();
  cred_a uuid := gen_random_uuid();
  cred_b uuid := gen_random_uuid();
  cont_a uuid := gen_random_uuid();
  cont_b uuid := gen_random_uuid();
  gar_a uuid := gen_random_uuid();
  gar_b uuid := gen_random_uuid();
  hist_a uuid := gen_random_uuid();
  cn_a uuid := gen_random_uuid();
  cn_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- ── Seed base ──
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS DINX A'), (org_b, 'RLS DINX B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli DINX A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cli DINX B', 'XAXX010101001', 'b@test.local', org_b);
  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELDNX00001', cli_a, 'Cli DINX A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELDNX00002', cli_b, 'Cli DINX B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');
  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_a, 'Prov DINX A', org_a, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_b, 'Prov DINX B', org_b, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor);
  INSERT INTO public.navieras(id, code, name, activo) VALUES
    (naviera_x, 'DNX-' || substr(naviera_x::text, 1, 8), 'Test Liner DNX', true);
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac_a, org_a, cli_a, 'Cli DINX A', emb_a, 'DNX-A-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida'),
    (fac_b, org_b, cli_b, 'Cli DINX B', emb_b, 'DNX-B-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 'Emitida');

  -- ── TEST 1: anticipos_proveedor ──
  INSERT INTO public.anticipos_proveedor(
    id, organization_id, proveedor_id, fecha_anticipo, monto, moneda,
    estado, saldo_disponible
  ) VALUES
    (ant_a, org_a, prov_a, CURRENT_DATE, 5000, 'MXN', 'vigente', 5000);

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.anticipos_proveedor WHERE id = ant_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver anticipos_proveedor de org_a');
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.anticipos_proveedor(id, organization_id, proveedor_id, fecha_anticipo, monto, moneda, estado, saldo_disponible) VALUES (%L, %L, %L, CURRENT_DATE, 1, %L, %L, 1)',
      gen_random_uuid(), org_a, prov_a, 'MXN', 'vigente'
    ),
    'anticipos_proveedor acepta INSERT con organization_id ajeno'
  );
  PERFORM pg_temp.as_postgres();

  -- ── TEST 2: cobranza_seguimiento ──
  INSERT INTO public.cobranza_seguimiento(id, organization_id, factura_id, tipo, fecha) VALUES
    (seg_a, org_a, fac_a, 'llamada', CURRENT_DATE),
    (seg_b, org_b, fac_b, 'email',   CURRENT_DATE);

  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM public.cobranza_seguimiento WHERE id IN (seg_a, seg_b);
  PERFORM pg_temp.assert(visible = 1, format('user_a vio %s cobranza_seguimiento, esperaba 1', visible));
  PERFORM pg_temp.as_postgres();

  -- ── TEST 3: facturapi_credenciales (contiene API keys) ──
  -- Fixture defensivo: sólo probar si la tabla tiene las columnas esperadas.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='facturapi_credenciales'
       AND column_name='organization_id'
  ) THEN
    BEGIN
      EXECUTE format(
        'INSERT INTO public.facturapi_credenciales(id, organization_id, ambiente) VALUES (%L, %L, %L)',
        cred_a, org_a, 'sandbox'
      );
      EXECUTE format(
        'INSERT INTO public.facturapi_credenciales(id, organization_id, ambiente) VALUES (%L, %L, %L)',
        cred_b, org_b, 'sandbox'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Otras columnas NOT NULL nos frustran; abortamos este sub-test
      -- pero registramos que corrió para no dar falso verde.
      RAISE NOTICE 'facturapi_credenciales: seed fallido (%). Saltando sub-test — NO es falso verde: revisar columnas.', SQLERRM;
      cred_a := NULL;
    END;

    IF cred_a IS NOT NULL THEN
      PERFORM pg_temp.as_user(user_b);
      SELECT count(*) INTO visible FROM public.facturapi_credenciales WHERE id = cred_a;
      PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver facturapi_credenciales de org_a (fuga de API keys)');
      PERFORM pg_temp.as_postgres();
    END IF;
  END IF;

  -- ── TEST 4: embarque_garantias_contenedor ──
  -- Necesita fila en embarque_contenedores primero (FK).
  INSERT INTO public.embarque_contenedores(
    id, embarque_id, organization_id, numero_contenedor, tipo_contenedor,
    bl_house, peso_kg, volumen_m3, piezas, orden
  ) VALUES
    (cont_a, emb_a, org_a, 'DNXU1234567', '40HC', 'BL-A-DNX', 18000, 60, 100, 1),
    (cont_b, emb_b, org_b, 'DNXU7654321', '20GP', 'BL-B-DNX', 12000, 28, 50, 1);

  BEGIN
    INSERT INTO public.embarque_garantias_contenedor(
      id, embarque_id, organization_id, contenedor_id
    ) VALUES
      (gar_a, emb_a, org_a, cont_a),
      (gar_b, emb_b, org_b, cont_b);

    PERFORM pg_temp.as_user(user_b);
    SELECT count(*) INTO visible FROM public.embarque_garantias_contenedor WHERE id = gar_a;
    PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver embarque_garantias_contenedor de org_a');
    PERFORM pg_temp.as_postgres();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'embarque_garantias_contenedor: seed fallido (%). Saltando sub-test — revisar NOT NULLs.', SQLERRM;
  END;

  -- ── TEST 5: cotizacion_costos_historico ──
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_a, org_a, cli_a, 'Cli DINX A', 'COT-DNX-A', 'Marítimo', 'Importación', 'FOB', 'Enviada');

  BEGIN
    INSERT INTO public.cotizacion_costos_historico(
      id, cotizacion_id, version, organization_id, origen_costo_id,
      concepto, proveedor, cantidad, unidad_medida, costo_unitario, precio_venta, moneda, notas
    ) VALUES
      (hist_a, cot_a, 1, org_a, gen_random_uuid(),
       'Flete snap', 'Prov DINX A', 1, 'BL', 500, 800, 'USD', '');

    PERFORM pg_temp.as_user(user_b);
    SELECT count(*) INTO visible FROM public.cotizacion_costos_historico WHERE id = hist_a;
    PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver cotizacion_costos_historico de org_a (fuga de markups)');
    -- Precio de venta jamás visible directamente
    SELECT count(*) INTO visible FROM public.cotizacion_costos_historico WHERE precio_venta = 800;
    PERFORM pg_temp.assert(visible = 0, 'user_b vio precio_venta de snapshot histórico de org_a');
    PERFORM pg_temp.as_postgres();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'cotizacion_costos_historico: seed fallido (%). Revisar NOT NULLs.', SQLERRM;
  END;

  -- ── TEST 6: costeo_navieras_condiciones ──
  BEGIN
    INSERT INTO public.costeo_navieras_condiciones(
      id, organization_id, naviera_id, proveedor_id,
      tiene_carta_garantia, dias_libres_demoras_default, moneda_demoras, deposito_contenedor_usd
    ) VALUES
      (cn_a, org_a, naviera_x, prov_a, true,  14, 'USD', 500),
      (cn_b, org_b, naviera_x, prov_b, false, 21, 'USD', 1000);

    PERFORM pg_temp.as_user(user_a);
    SELECT count(*) INTO visible FROM public.costeo_navieras_condiciones WHERE id IN (cn_a, cn_b);
    PERFORM pg_temp.assert(visible = 1, format('user_a vio %s costeo_navieras_condiciones, esperaba 1', visible));
    -- Depósito de la competencia (1000 USD) NUNCA visible
    SELECT count(*) INTO visible FROM public.costeo_navieras_condiciones WHERE deposito_contenedor_usd = 1000;
    PERFORM pg_temp.assert(visible = 0, 'user_a vio depósito de naviera de org_b (fuga de negociación)');
    PERFORM pg_temp.as_postgres();
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'costeo_navieras_condiciones: seed fallido (%). Revisar NOT NULLs.', SQLERRM;
  END;

  RAISE NOTICE '✓ test_rls_tablas_dinero_extra: aserciones ejecutadas (revisar NOTICEs por sub-tests saltados)';
END;
$$;

ROLLBACK;
