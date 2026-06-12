-- ============================================================================
-- Suite de pruebas de RLS — Capa Financiera (Libre Carga)
-- ============================================================================
--
-- Extiende test_rls_isolation.sql para validar aislamiento multi-tenant en
-- las tablas financieras críticas:
--   - facturas
--   - cuentas_por_cobrar
--   - gastos_embarque
--   - proformas
--   - cotizaciones
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_financiero.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. Diseñado para bases de prueba
-- o staging — NO ejecutar en producción.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(_user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _user_id, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('role', 'authenticated', true);
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'RLS FINANCIERO FAIL: %', msg;
  END IF;
END;
$$;

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
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  prof_a uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  gasto_a uuid := gen_random_uuid();
  visible int;
BEGIN
  -- Seed mínimo (bypass RLS como rol postgres)
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS FIN A'), (org_b, 'RLS FIN B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin'), (org_b, user_b, 'admin');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin'), (user_b, 'admin');

  INSERT INTO public.clientes(id, nombre, organization_id) VALUES
    (cli_a, 'Cliente Fin A', org_a),
    (cli_b, 'Cliente Fin B', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm)
  VALUES
    (emb_a, 'EXP-FIN-A', cli_a, 'Cliente Fin A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'EXP-FIN-B', cli_b, 'Cliente Fin B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  -- =========================================================================
  -- TEST 1: facturas aislamiento
  -- =========================================================================
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, saldo, estado
  ) VALUES
    (fac_a, org_a, cli_a, 'Cliente Fin A', emb_a, 'FA-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 1160, 'Pendiente'),
    (fac_b, org_b, cli_b, 'Cliente Fin B', emb_b, 'FB-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 2320, 'Pendiente');

  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM public.facturas;
  PERFORM pg_temp.assert(visible = 1, format('user_a debe ver 1 factura, vio %s', visible));
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'user_a NO debe ver factura de org_b');
  RESET ROLE;

  -- =========================================================================
  -- TEST 2: proformas aislamiento
  -- =========================================================================
  INSERT INTO public.proformas(
    id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente,
    numero, fecha_emision, subtotal_usd, iva_usd, total_usd,
    subtotal_mxn, iva_mxn, total_mxn, estado
  ) VALUES
    (prof_a, org_a, emb_a, cli_a, 'Cliente Fin A', 'EXP-FIN-A',
      'PA-001', CURRENT_DATE, 100, 16, 116, 0, 0, 0, 'Borrador');

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.proformas WHERE id = prof_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver proforma de org_a');
  RESET ROLE;

  -- =========================================================================
  -- TEST 3: cotizaciones aislamiento
  -- =========================================================================
  INSERT INTO public.cotizaciones(
    id, organization_id, cliente_id, cliente_nombre, modo, tipo, incoterm, estado
  ) VALUES
    (cot_a, org_a, cli_a, 'Cliente Fin A', 'Marítimo', 'Importación', 'FOB', 'Cotizada');

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.cotizaciones WHERE id = cot_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver cotización de org_a');
  RESET ROLE;

  -- =========================================================================
  -- TEST 4: cuentas_por_cobrar derivadas de facturas
  -- =========================================================================
  -- Algunas implementaciones derivan CxC vía view o tabla; chequeamos si existe.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'cuentas_por_cobrar') THEN
    PERFORM pg_temp.as_user(user_a);
    EXECUTE 'SELECT count(*) FROM public.cuentas_por_cobrar WHERE organization_id = $1' INTO visible USING org_b;
    PERFORM pg_temp.assert(visible = 0, 'user_a NO debe ver CxC de org_b');
    RESET ROLE;
  END IF;

  -- =========================================================================
  -- TEST 5: gastos_embarque aislamiento (si la tabla existe)
  -- =========================================================================
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'gastos_embarque') THEN
    EXECUTE format(
      'INSERT INTO public.gastos_embarque(id, organization_id, embarque_id, concepto, monto, moneda)
       VALUES (%L, %L, %L, %L, %L, %L)',
      gasto_a, org_a, emb_a, 'Maniobras', 500, 'MXN'
    );
    PERFORM pg_temp.as_user(user_b);
    EXECUTE 'SELECT count(*) FROM public.gastos_embarque WHERE id = $1' INTO visible USING gasto_a;
    PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver gasto de org_a');
    RESET ROLE;
  END IF;

  RAISE NOTICE 'RLS FINANCIERO: todas las aserciones pasaron';
END;
$$;

ROLLBACK;
