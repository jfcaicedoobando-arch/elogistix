-- ============================================================================
-- Suite de pruebas de RLS — Roles NO administradores
-- ============================================================================
--
-- Hasta ahora todas las suites RLS solo verificaban el rol `admin`. Esta suite
-- cubre la matriz {viewer, operador, cliente} × {SELECT, INSERT/UPDATE/DELETE}
-- × tablas financieras críticas (facturas, pagos_factura, embarques,
-- cotizaciones, comisiones_devengadas) para detectar policies mal escritas
-- que dejen escalar privilegios o cruzar tenants.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_roles_no_admin.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql


DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  viewer_a uuid := gen_random_uuid();
  operador_a uuid := gen_random_uuid();
  cli_user uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  pago_a uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  visible int;
BEGIN
  -- ── Seed ──────────────────────────────────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS NoAdmin A'), (org_b, 'RLS NoAdmin B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, admin_a, 'admin_org'),
    (org_a, viewer_a, 'customer_service'),
    (org_a, operador_a, 'coordinador_logistico');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (admin_a, 'admin_org'),
    (viewer_a, 'customer_service'),
    (operador_a, 'coordinador_logistico'),
    (cli_user, 'cliente')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cliente NA A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cliente NA B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.client_users(cliente_id, user_id, organization_id) VALUES
    (cli_a, cli_user, org_a);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELNAD00001', cli_a, 'Cliente NA A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELNAD00002', cli_b, 'Cliente NA B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  -- Facturas timbradas (uuid_fiscal + timbrado_en): estado realista para
  -- recibir pagos y evitar dependencia del early-exit del guard de REP.
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES
    (fac_a, org_a, cli_a, 'Cliente NA A', emb_a, 'NA-A-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida',
      gen_random_uuid()::text, now()),
    (fac_b, org_b, cli_b, 'Cliente NA B', emb_b, 'NA-B-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 'Emitida',
      gen_random_uuid()::text, now());

  INSERT INTO public.pagos_factura(
    id, organization_id, factura_id, monto, monto_aplicado_factura,
    moneda, tipo_cambio, fecha_pago, forma_pago
  ) VALUES
    (pago_a, org_a, fac_a, 500, 500, 'MXN', 1, CURRENT_DATE, 'Transferencia');

  INSERT INTO public.cotizaciones(
    id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado
  ) VALUES
    (cot_a, org_a, cli_a, 'Cliente NA A', 'COT-RLS-NA-A', 'Marítimo', 'Importación', 'FOB', 'Enviada');

  -- ════════════════════════════════════════════════════════════════════════
  -- ROL VIEWER (org_a) — solo lectura
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(viewer_a);

  -- TEST 1: viewer ve facturas de su org
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer_a debe ver factura de org_a');

  -- TEST 2: viewer NO ve facturas de otra org
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'viewer_a NO debe ver factura de org_b');

  -- TEST 3: viewer ve embarques y cotizaciones de su org
  SELECT count(*) INTO visible FROM public.embarques WHERE id = emb_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer_a debe ver embarque de org_a');
  SELECT count(*) INTO visible FROM public.cotizaciones WHERE id = cot_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer_a debe ver cotización de org_a');
  SELECT count(*) INTO visible FROM public.pagos_factura WHERE id = pago_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer_a debe ver pago de org_a');

  -- TEST 4: viewer NO puede INSERT factura en su org
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id, numero, fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado) VALUES (%L, %L, %L, %L, %L, %L, CURRENT_DATE, CURRENT_DATE+15, %L, 1, 0, 1, %L)',
      gen_random_uuid(), org_a, cli_a, 'X', emb_a, 'VIEWER-INS', 'MXN', 'Emitida'
    ),
    'viewer_a NO debe poder INSERT facturas'
  );

  -- TEST 5: viewer NO puede UPDATE (verificar que el estado NO cambió a 'Pagada').
  -- Nota: el trigger `recalcular_estado_factura` ya movió fac_a a
  -- 'Parcialmente pagada' al insertar pago_a, así que aquí solo nos importa
  -- que el UPDATE del viewer (que intenta 'Pagada') NO haya tenido efecto.
  UPDATE public.facturas SET estado = 'Pagada' WHERE id = fac_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a AND estado <> 'Pagada';
  PERFORM pg_temp.assert(visible = 1, 'viewer_a NO debe poder UPDATE facturas (estado no debe quedar Pagada)');
  PERFORM pg_temp.as_user(viewer_a);

  -- TEST 6: viewer NO puede DELETE
  -- v13.777.10: `authenticated` ya no tiene GRANT DELETE sobre facturas
  -- (borrado físico prohibido); insufficient_privilege también es "bloqueado".
  BEGIN
    DELETE FROM public.facturas WHERE id = fac_a;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'viewer_a NO debe poder DELETE facturas');

  -- ════════════════════════════════════════════════════════════════════════
  -- ROL OPERADOR (org_a) — CRUD dentro de su org
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(operador_a);

  -- TEST 7: operador ve facturas de su org, NO de otra org
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'operador_a debe ver factura de org_a');
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'operador_a NO debe ver factura de org_b');

  -- TEST 8: operador NO puede INSERT en org ajena (cross-tenant)
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id, numero, fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado) VALUES (%L, %L, %L, %L, %L, %L, CURRENT_DATE, CURRENT_DATE+15, %L, 1, 0, 1, %L)',
      gen_random_uuid(), org_b, cli_b, 'X', emb_b, 'OPER-CROSS', 'MXN', 'Emitida'
    ),
    'operador_a NO debe poder INSERT facturas en org_b'
  );

  -- TEST 9: operador NO puede UPDATE factura de otra org
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = fac_b;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b AND estado = 'Emitida';
  PERFORM pg_temp.assert(visible = 1, 'operador_a NO debe poder UPDATE factura de org_b');
  PERFORM pg_temp.as_user(operador_a);

  -- TEST 10: operador NO puede DELETE factura de otra org
  BEGIN
    DELETE FROM public.facturas WHERE id = fac_b;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 1, 'operador_a NO debe poder DELETE factura de org_b');

  -- TEST 11: operador NO puede DELETE pago_factura de otra org (defensa en profundidad)
  PERFORM pg_temp.as_user(operador_a);
  DELETE FROM public.pagos_factura WHERE organization_id = org_b;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.pagos_factura WHERE id = pago_a;
  PERFORM pg_temp.assert(visible = 1, 'operador_a NO debe afectar pagos de org_b (pago_a debe seguir intacto)');

  -- TEST 11b (13.135.6): operador NO puede auto-asignarse super_admin.
  -- Escalada clásica: insertar (user_id=self, role='super_admin') en user_roles
  -- bypassearía toda la matriz de policies (super_admin es el "wildcard tenant").
  -- La policy "Admins manage non-super-admin roles" debe rechazar este INSERT.
  PERFORM pg_temp.as_user(operador_a);
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.user_roles(user_id, role) VALUES (%L, %L)',
      operador_a, 'super_admin'
    ),
    'operador_a NO debe poder auto-asignarse super_admin via user_roles'
  );


  -- ════════════════════════════════════════════════════════════════════════
  -- ROL CLIENTE (portal) — aislamiento estricto + sin acceso a internos
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(cli_user);

  -- TEST 12: cliente solo ve facturas vinculadas a su cliente_id
  SELECT count(*) INTO visible FROM public.facturas;
  PERFORM pg_temp.assert(visible = 1, format('cliente debe ver solo sus facturas, vio %s', visible));
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'cliente debe ver su factura (fac_a)');
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'cliente NO debe ver factura de otra org (fac_b)');

  -- TEST 13: cliente NO puede INSERT facturas
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id, numero, fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado) VALUES (%L, %L, %L, %L, %L, %L, CURRENT_DATE, CURRENT_DATE+15, %L, 1, 0, 1, %L)',
      gen_random_uuid(), org_a, cli_a, 'X', emb_a, 'CLI-INS', 'MXN', 'Emitida'
    ),
    'cliente NO debe poder INSERT facturas'
  );

  -- TEST 14: cliente NO puede UPDATE facturas (mismo razonamiento que TEST 5)
  UPDATE public.facturas SET estado = 'Pagada' WHERE id = fac_a;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a AND estado <> 'Pagada';
  PERFORM pg_temp.assert(visible = 1, 'cliente NO debe poder UPDATE facturas (estado no debe quedar Pagada)');
  PERFORM pg_temp.as_user(cli_user);

  -- TEST 15: cliente NO puede DELETE facturas
  -- v13.777.10: además de RLS, `authenticated` ya no tiene el GRANT DELETE
  -- sobre facturas (borrado físico prohibido), así que el intento puede
  -- fallar con insufficient_privilege; ambos desenlaces son correctos.
  BEGIN
    DELETE FROM public.facturas WHERE id = fac_a;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM pg_temp.as_postgres();
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'cliente NO debe poder DELETE facturas');


  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'RLS ROLES NO-ADMIN: todas las aserciones pasaron';
END;
$$;

ROLLBACK;
