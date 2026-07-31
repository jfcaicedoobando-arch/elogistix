-- ============================================================================
-- Suite RLS — Regresión R4 P0-2 · ejecutivo_pricing NO escribe embarques
-- ============================================================================
-- Contrato de negocio:
--   - ejecutivo_pricing (Pricing/Ventas) LEE embarques (hereda 'viewer').
--   - ejecutivo_pricing NO puede modificar embarques (ya no hereda 'operador').
--   - ejecutivo_pricing SÍ escribe cotizaciones y cotizacion_costos.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_r4_pricing.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a     uuid := gen_random_uuid();
  pricing_a uuid := gen_random_uuid();
  cli_a     uuid := gen_random_uuid();
  emb_a     uuid := gen_random_uuid();
  cot_a     uuid := gen_random_uuid();
  cc_new    uuid := gen_random_uuid();
  prov_a    uuid := gen_random_uuid();
  ag_new    uuid := gen_random_uuid();
  pto_o     uuid := gen_random_uuid();
  pto_d     uuid := gen_random_uuid();
  nav_a     uuid := gen_random_uuid();
  tipo_a    uuid := gen_random_uuid();
  ruta_new  uuid := gen_random_uuid();
  tar_new   uuid := gen_random_uuid();
  afectadas int;
  visible   int;
BEGIN
  -- ── Seed ──────────────────────────────────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS R4 Pricing A');

  INSERT INTO public.organization_members(organization_id, user_id, role)
    VALUES (org_a, pricing_a, 'ejecutivo_pricing');

  INSERT INTO public.user_roles(user_id, role)
    VALUES (pricing_a, 'ejecutivo_pricing');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
    VALUES (cli_a, 'Cli R4 Pricing A', 'XAXX010101000', 'r4pricing@example.com', org_a);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
    VALUES (emb_a, 'ELRPR00001', cli_a, 'Cli R4 Pricing A', org_a, 'Marítimo', 'Importación');

  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado)
    VALUES (cot_a, org_a, cli_a, 'Cli R4 Pricing A', 'COT-R4P-A', 'Marítimo', 'Importación', 'FOB', 'Borrador');

  -- Catálogos base para las pruebas de costeo (R4 P0-2, impacto colateral)
  INSERT INTO public.proveedores(id, nombre, organization_id, categoria, tipo)
    VALUES (prov_a, 'Prov R4 Pricing A', org_a, 'Logistico', 'Naviera');
  INSERT INTO public.puertos(id, code, name, country)
    VALUES (pto_o, 'CNSHA', 'Shanghai', 'CN'), (pto_d, 'MXZLO', 'Manzanillo', 'MX');
  INSERT INTO public.navieras(id, code, name) VALUES (nav_a, 'R4PN', 'Naviera R4P');
  INSERT INTO public.tipos_contenedor(id, code, name) VALUES (tipo_a, '40HC-R4P', '40 HC R4P');

  -- =========================================================================
  -- TEST 1 (R4 P0-2): pricing LEE embarques de su org (hereda viewer)
  -- =========================================================================
  PERFORM pg_temp.as_user(pricing_a);
  SELECT count(*) INTO visible FROM public.embarques WHERE id = emb_a;
  PERFORM pg_temp.assert(visible = 1, 'ejecutivo_pricing debe poder LEER embarques de su org');

  -- =========================================================================
  -- TEST 2 (R4 P0-2): pricing NO puede modificar embarques
  -- =========================================================================
  BEGIN
    UPDATE public.embarques SET cliente_nombre = 'HACKEADO' WHERE id = emb_a;
    GET DIAGNOSTICS afectadas = ROW_COUNT;
    PERFORM pg_temp.assert(
      afectadas = 0,
      'ejecutivo_pricing NO debe poder modificar embarques (filas afectadas=' || afectadas || ')'
    );
  EXCEPTION
    WHEN insufficient_privilege OR check_violation OR raise_exception THEN
      NULL; -- bloqueo por RLS/trigger también es resultado válido
  END;

  -- =========================================================================
  -- TEST 3 (R4 P0-2): pricing NO puede insertar embarques
  -- =========================================================================
  PERFORM pg_temp.assert_insert_blocked(
    format(
      $q$INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
         VALUES (%L, 'ELRPR09999', %L, 'Cli R4 Pricing A', %L, 'Marítimo', 'Importación')$q$,
      gen_random_uuid(), cli_a, org_a
    ),
    'ejecutivo_pricing NO debe poder crear embarques'
  );

  -- =========================================================================
  -- TEST 4 (R4 P0-2): pricing SÍ escribe cotizaciones de su org
  -- =========================================================================
  UPDATE public.cotizaciones SET cliente_nombre = 'Cli R4 Pricing A (edit)' WHERE id = cot_a;
  GET DIAGNOSTICS afectadas = ROW_COUNT;
  PERFORM pg_temp.assert(
    afectadas = 1,
    'ejecutivo_pricing debe poder editar cotizaciones de su org (filas afectadas=' || afectadas || ')'
  );

  -- =========================================================================
  -- TEST 5 (R4 P0-2): pricing SÍ escribe cotizacion_costos de su org
  -- =========================================================================
  INSERT INTO public.cotizacion_costos(
    id, cotizacion_id, concepto, moneda, proveedor, cantidad, costo_unitario,
    precio_venta, unidad_medida, organization_id, notas
  ) VALUES (
    cc_new, cot_a, 'Flete R4P', 'USD', 'Prov R4P', 1, 100, 200, 'BL', org_a, ''
  );
  SELECT count(*) INTO visible FROM public.cotizacion_costos WHERE id = cc_new;
  PERFORM pg_temp.assert(visible = 1, 'ejecutivo_pricing debe poder crear costos de cotización');

  -- =========================================================================
  -- TEST 6 (R4 P0-2): pricing SÍ escribe costeo_agentes de su org
  -- =========================================================================
  INSERT INTO public.costeo_agentes(id, organization_id, proveedor_id, nombre, pais, dias_credito, activo)
    VALUES (ag_new, org_a, prov_a, 'Agente R4P', 'CN', 30, true);
  SELECT count(*) INTO visible FROM public.costeo_agentes WHERE id = ag_new;
  PERFORM pg_temp.assert(visible = 1, 'ejecutivo_pricing debe poder crear agentes de costeo');

  -- =========================================================================
  -- TEST 7 (R4 P0-2): pricing SÍ escribe costeo_rutas de su org
  -- =========================================================================
  INSERT INTO public.costeo_rutas(id, organization_id, puerto_origen_id, puerto_destino_id, activa)
    VALUES (ruta_new, org_a, pto_o, pto_d, true);
  SELECT count(*) INTO visible FROM public.costeo_rutas WHERE id = ruta_new;
  PERFORM pg_temp.assert(visible = 1, 'ejecutivo_pricing debe poder crear rutas de costeo');

  -- =========================================================================
  -- TEST 8 (R4 P0-2): pricing SÍ escribe costeo_tarifas de su org
  -- =========================================================================
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES (
    tar_new, org_a, ag_new, nav_a, ruta_new, tipo_a,
    'USD', 2500, 14, CURRENT_DATE, CURRENT_DATE + 30
  );
  SELECT count(*) INTO visible FROM public.costeo_tarifas WHERE id = tar_new;
  PERFORM pg_temp.assert(visible = 1, 'ejecutivo_pricing debe poder crear tarifas de costeo');

  PERFORM pg_temp.as_postgres();

  RAISE NOTICE 'test_rls_reg_r4_pricing: OK';
END $$;

ROLLBACK;
