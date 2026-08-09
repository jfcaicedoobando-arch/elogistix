-- ============================================================================
-- Suite RLS — Reportes NUNCA mezclan datos entre organizaciones
-- ============================================================================
-- Cubre las RPCs SECURITY DEFINER de reportes (aging CxC/CxP y libro de pagos)
-- desde varios roles y tenants:
--   1. Un usuario de org_b sólo ve su propia cartera (aunque pase p_org ajeno).
--   2. Roles no administrativos (contador, viewer) tampoco ven otra org.
--   3. Un super_admin SIN organización activa recibe LC_ORG_REQUERIDA
--      (fail-closed) en lugar de ver todos los tenants mezclados.
--   4. Un super_admin CON p_org sólo ve la organización elegida.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reportes_multi_tenant.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Espera que el SQL falle (42501 / P0001) con un texto contenido en el mensaje.
CREATE OR REPLACE FUNCTION pg_temp.assert_falla_con(_sql text, _needle text, _msg text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_msg text;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || _sql || ') _t';
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      GET STACKED DIAGNOSTICS v_msg = MESSAGE_TEXT;
      IF position(_needle IN v_msg) = 0 THEN
        RAISE EXCEPTION 'RLS TEST FAIL: % — falló con "%" y se esperaba "%"', _msg, v_msg, _needle;
      END IF;
      RETURN;
  END;
  RAISE EXCEPTION 'RLS TEST FAIL: % — la llamada NO fue rechazada', _msg;
END;
$$;

-- Cuenta filas; si la RPC lanza excepción de permisos también es seguro.
CREATE OR REPLACE FUNCTION pg_temp.assert_rows(_sql text, _expected int, _msg text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  BEGIN
    EXECUTE 'SELECT count(*) FROM (' || _sql || ') _t' INTO v_count;
  EXCEPTION
    WHEN insufficient_privilege OR raise_exception THEN
      RETURN;
  END;
  IF v_count <> _expected THEN
    RAISE EXCEPTION 'RLS TEST FAIL: % — filas esperadas %, obtenidas %', _msg, _expected, v_count;
  END IF;
END;
$$;

DO $$
DECLARE
  org_a  uuid := gen_random_uuid();
  org_b  uuid := gen_random_uuid();
  u_a    uuid := gen_random_uuid();  -- admin_org de org_a
  u_cont uuid := gen_random_uuid();  -- contador de org_a
  u_view uuid := gen_random_uuid();  -- viewer de org_a
  u_b    uuid := gen_random_uuid();  -- admin_org de org_b
  u_sa   uuid := gen_random_uuid();  -- super_admin sin membresía
  cli_a  uuid := gen_random_uuid();
  cli_b  uuid := gen_random_uuid();
  emb_a  uuid := gen_random_uuid();
  emb_b  uuid := gen_random_uuid();
  fac_a  uuid := gen_random_uuid();
  fac_b  uuid := gen_random_uuid();
  v_libro jsonb;
  v_ajenas int;
BEGIN
  -- ── Seed de dos tenants ──────────────────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS REP A'), (org_b, 'RLS REP B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_a, 'admin_org'),
    (org_a, u_cont, 'contador'),
    (org_a, u_view, 'viewer'),
    (org_b, u_b, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_a, 'admin_org'), (u_cont, 'contador'), (u_view, 'viewer'),
    (u_b, 'admin_org'), (u_sa, 'super_admin');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'CLI REP A', 'XAXX010101010', 'repa@test.local', org_a),
    (cli_b, 'CLI REP B', 'XAXX010101011', 'repb@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELREP00001', cli_a, 'CLI REP A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELREP00002', cli_b, 'CLI REP B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES
    (fac_a, org_a, cli_a, 'CLI REP A', emb_a, 'REP-A-001',
      CURRENT_DATE - 100, CURRENT_DATE - 70, 'MXN', 1000, 160, 1160, 'Emitida',
      gen_random_uuid()::text, now()),
    (fac_b, org_b, cli_b, 'CLI REP B', emb_b, 'REP-B-001',
      CURRENT_DATE - 100, CURRENT_DATE - 70, 'MXN', 2000, 320, 2320, 'Emitida',
      gen_random_uuid()::text, now());

  -- Cobros parciales para poblar el libro de pagos de cada org.
  INSERT INTO public.pagos_factura(
    organization_id, factura_id, fecha_pago, monto, moneda,
    monto_aplicado_factura, forma_pago
  ) VALUES
    (org_a, fac_a, CURRENT_DATE, 100, 'MXN', 100, 'Transferencia'),
    (org_b, fac_b, CURRENT_DATE, 200, 'MXN', 200, 'Transferencia');

  -- ── 1. Usuario de org_b no puede ver la cartera de org_a ────────────────
  PERFORM pg_temp.as_user(u_b);

  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxc_aging_clientes(%L::uuid, CURRENT_DATE)', org_a),
    0, 'cxc_aging_clientes(org_a) desde admin_org de org_b'
  );
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxp_aging_proveedores(%L::uuid, CURRENT_DATE)', org_a),
    0, 'cxp_aging_proveedores(org_a) desde admin_org de org_b'
  );
  PERFORM pg_temp.assert_falla_con(
    format('SELECT public.libro_pagos(CURRENT_DATE - 5, CURRENT_DATE, %L::uuid)', org_a),
    'LC_ORG_AJENA', 'libro_pagos(org_a) desde admin_org de org_b'
  );

  -- Su propio libro sólo trae su contraparte.
  v_libro := public.libro_pagos(CURRENT_DATE - 5, CURRENT_DATE, NULL);
  SELECT count(*) INTO v_ajenas
    FROM jsonb_array_elements(COALESCE(v_libro->'pagos', '[]'::jsonb)) p
   WHERE p->>'contraparte' = 'CLI REP A';
  PERFORM pg_temp.assert(v_ajenas = 0,
    'libro_pagos de org_b incluyó cobros de org_a');

  -- ── 2. Roles no administrativos de org_a tampoco cruzan tenant ──────────
  PERFORM pg_temp.as_user(u_cont);
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxc_aging_clientes(%L::uuid, CURRENT_DATE)', org_b),
    0, 'cxc_aging_clientes(org_b) desde contador de org_a'
  );
  PERFORM pg_temp.assert_falla_con(
    format('SELECT public.libro_pagos(CURRENT_DATE - 5, CURRENT_DATE, %L::uuid)', org_b),
    'LC_ORG_AJENA', 'libro_pagos(org_b) desde contador de org_a'
  );

  PERFORM pg_temp.as_user(u_view);
  PERFORM pg_temp.assert_rows(
    format('SELECT * FROM public.cxp_aging_proveedores(%L::uuid, CURRENT_DATE)', org_b),
    0, 'cxp_aging_proveedores(org_b) desde viewer de org_a'
  );

  -- El contador de org_a sí ve su propia cartera (no es un falso verde).
  PERFORM pg_temp.as_user(u_cont);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.cxc_aging_clientes(NULL, CURRENT_DATE)) >= 1,
    'contador de org_a debería ver su propia cartera CxC'
  );

  -- ── 3. super_admin SIN organización activa: fail-closed ─────────────────
  PERFORM pg_temp.as_user(u_sa);
  PERFORM pg_temp.assert_falla_con(
    'SELECT * FROM public.cxc_aging_clientes(NULL, CURRENT_DATE)',
    'LC_ORG_REQUERIDA', 'cxc_aging_clientes sin p_org como super_admin'
  );
  PERFORM pg_temp.assert_falla_con(
    'SELECT * FROM public.cxp_aging_proveedores(NULL, CURRENT_DATE)',
    'LC_ORG_REQUERIDA', 'cxp_aging_proveedores sin p_org como super_admin'
  );
  PERFORM pg_temp.assert_falla_con(
    'SELECT public.libro_pagos(CURRENT_DATE - 5, CURRENT_DATE, NULL)',
    'LC_ORG_REQUERIDA', 'libro_pagos sin p_org como super_admin'
  );

  -- ── 4. super_admin CON p_org: sólo el tenant elegido ────────────────────
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.cxc_aging_clientes(org_a, CURRENT_DATE)
      WHERE cliente_nombre = 'CLI REP B') = 0,
    'cxc_aging_clientes(org_a) como super_admin fugó clientes de org_b'
  );
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.cxc_aging_clientes(org_a, CURRENT_DATE)
      WHERE cliente_nombre = 'CLI REP A') = 1,
    'cxc_aging_clientes(org_a) como super_admin no devolvió el cliente de org_a'
  );

  v_libro := public.libro_pagos(CURRENT_DATE - 5, CURRENT_DATE, org_a);
  SELECT count(*) INTO v_ajenas
    FROM jsonb_array_elements(COALESCE(v_libro->'pagos', '[]'::jsonb)) p
   WHERE p->>'contraparte' = 'CLI REP B';
  PERFORM pg_temp.assert(v_ajenas = 0,
    'libro_pagos(org_a) como super_admin incluyó cobros de org_b');

  SELECT count(*) INTO v_ajenas
    FROM jsonb_array_elements(COALESCE(v_libro->'pagos', '[]'::jsonb)) p
   WHERE p->>'contraparte' = 'CLI REP A';
  PERFORM pg_temp.assert(v_ajenas = 1,
    'libro_pagos(org_a) como super_admin no devolvió el cobro de org_a');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'OK — reportes aislados por organización en todos los roles probados';
END $$;

ROLLBACK;
