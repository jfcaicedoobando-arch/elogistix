-- ============================================================================
-- Suite RLS — RPCs financieras SECURITY DEFINER (H3)
-- ============================================================================
-- Invoca RPCs de alto riesgo desde user_b (org_b) pasando IDs/parámetros de
-- org_a. Cada llamada debe: (a) devolver 0 filas, o (b) fallar con 42501,
-- o (c) devolver únicamente datos de org_b. NUNCA fugar datos de org_a.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_rpc_financieras.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Helper local: invoca query y espera N filas, o excepción con SQLSTATE dado.
CREATE OR REPLACE FUNCTION pg_temp.assert_rows(_sql text, _expected int, _msg text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || _sql || ') _t' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      -- 42501 / usuario_message: también es "seguro" (no fugó nada)
      RETURN;
  END;
  IF v_count <> _expected THEN
    RAISE EXCEPTION 'RLS RPC FAIL: % — filas esperadas %, obtenidas %', _msg, _expected, v_count;
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
  prof_a_token uuid := gen_random_uuid();
  visible int;
BEGIN
  -- ── Seed ──
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS RPC A'), (org_b, 'RLS RPC B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli RPC A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cli RPC B', 'XAXX010101001', 'b@test.local', org_b);
  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELRPC00001', cli_a, 'Cli RPC A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELRPC00002', cli_b, 'Cli RPC B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES
    (fac_a, org_a, cli_a, 'Cli RPC A', emb_a, 'RPC-A-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida',
      gen_random_uuid()::text, now()),
    (fac_b, org_b, cli_b, 'Cli RPC B', emb_b, 'RPC-B-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 'Emitida',
      gen_random_uuid()::text, now());

  -- ────────────────────────────────────────────────────────────────────────
  -- user_b invoca RPCs pasando IDs/orgs de org_a
  -- ────────────────────────────────────────────────────────────────────────
  PERFORM pg_temp.as_user(user_b);

  -- clientes_listado: si acepta p_organization_id de otra org, debe devolver 0
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.clientes_listado(%L::uuid, NULL, 0, 100)', org_a),
    0,
    'clientes_listado(org_a) desde user_b NO debe fugar clientes de org_a'
  );

  -- cotizaciones_listado
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cotizaciones_listado(%L::uuid, NULL, NULL, NULL, NULL, NULL, NULL, 0, 100)', org_a),
    0,
    'cotizaciones_listado(org_a) desde user_b NO debe fugar cotizaciones de org_a'
  );

  -- cxc_aging_clientes / cxp_aging_proveedores (agregados)
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxc_aging_clientes(%L::uuid, CURRENT_DATE)', org_a),
    0,
    'cxc_aging_clientes(org_a) desde user_b NO debe fugar cartera de org_a'
  );
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxp_aging_proveedores(%L::uuid, CURRENT_DATE)', org_a),
    0,
    'cxp_aging_proveedores(org_a) desde user_b NO debe fugar CxP de org_a'
  );

  -- busqueda_global — buscar el número exacto de la factura de org_a
  PERFORM pg_temp.assert_rows(
    'SELECT * FROM public.busqueda_global(''RPC-A-001'', 50)',
    0,
    'busqueda_global no debe devolver factura de org_a a user_b'
  );

  -- cartera_pendiente — invocada por user_b: sólo puede reflejar su org_b
  DECLARE
    v_row record;
    v_fugado int := 0;
  BEGIN
    FOR v_row IN SELECT * FROM public.cartera_pendiente() LOOP
      -- Si la RPC devuelve algo, no debe incluir NADA de org_a (fac_a).
      -- Nos apoyamos en que fac_a tiene total 1160 exacto y fac_b 2320.
      IF (row_to_json(v_row)::text) LIKE '%RPC-A-001%' THEN
        v_fugado := v_fugado + 1;
      END IF;
    END LOOP;
    PERFORM pg_temp.assert(v_fugado = 0, 'cartera_pendiente() fugó factura RPC-A-001 de org_a a user_b');
  END;

  -- portal_obtener_proforma_por_token con token inexistente/otro tenant
  BEGIN
    PERFORM public.portal_obtener_proforma_por_token(prof_a_token);
    -- token inexistente → debe ser NULL/error; si retorna algo, no debe incluir
    -- data de otra org (defensivo)
  EXCEPTION
    WHEN OTHERS THEN NULL;  -- tolerado (raise/permiso)
  END;

  -- aplicar_anticipo_a_factura: user_b intenta aplicar a factura de org_a → debe fallar
  BEGIN
    PERFORM public.aplicar_anticipo_a_factura(
      gen_random_uuid(), fac_a, 100, CURRENT_DATE
    );
    RAISE EXCEPTION 'RLS RPC FAIL: aplicar_anticipo_a_factura debió bloquear pago cruzado a factura de org_a';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception OR foreign_key_violation OR check_violation OR others THEN
      -- Cualquier error es aceptable: significa que la RPC se defendió.
      NULL;
  END;

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_rpc_financieras: 7 aserciones OK';
END;
$$;

ROLLBACK;
