-- ============================================================================
-- Suite RLS — Roles de negocio adicionales (H1)
-- ============================================================================
-- Cubre roles no probados en test_rls_roles_no_admin.sql:
--   - vendedor              → CRM scoped
--   - contador              → lectura financiera, mutación limitada
--   - tesorero              → cuentas bancarias / bbva_movimientos
--   - ejecutivo_cobranza    → cobranza_seguimiento
--   - super_admin (positivo)→ ve datos de todas las orgs
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_roles_negocio.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  vendedor_a uuid := gen_random_uuid();
  contador_a uuid := gen_random_uuid();
  tesorero_a uuid := gen_random_uuid();
  cobranza_a uuid := gen_random_uuid();
  super_u uuid := gen_random_uuid();
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  cuenta_a uuid := gen_random_uuid();
  cuenta_b uuid := gen_random_uuid();
  mov_a uuid := gen_random_uuid();
  mov_b uuid := gen_random_uuid();
  seg_a uuid := gen_random_uuid();
  seg_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- ── Seed ──────────────────────────────────────────────────────────────────
  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'RLS Roles Neg A'), (org_b, 'RLS Roles Neg B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, admin_a,    'admin_org'),
    (org_a, vendedor_a, 'vendedor'),
    (org_a, contador_a, 'contador'),
    (org_a, tesorero_a, 'tesorero'),
    (org_a, cobranza_a, 'ejecutivo_cobranza');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (admin_a,    'admin_org'),
    (vendedor_a, 'vendedor'),
    (contador_a, 'contador'),
    (tesorero_a, 'tesorero'),
    (cobranza_a, 'ejecutivo_cobranza'),
    (super_u,    'super_admin');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli Roles A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cli Roles B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELROL00001', cli_a, 'Cli Roles A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELROL00002', cli_b, 'Cli Roles B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES
    (fac_a, org_a, cli_a, 'Cli Roles A', emb_a, 'ROL-A-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida',
      gen_random_uuid()::text, now()),
    (fac_b, org_b, cli_b, 'Cli Roles B', emb_b, 'ROL-B-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 'Emitida',
      gen_random_uuid()::text, now());

  INSERT INTO public.cuentas_bancarias(id, organization_id, banco, alias, numero_cuenta, clabe, moneda, saldo_inicial, activa, notas) VALUES
    (cuenta_a, org_a, 'BBVA', 'Op A', '0001', '012180000000000001', 'MXN', 0, true, ''),
    (cuenta_b, org_b, 'BBVA', 'Op B', '0002', '012180000000000002', 'MXN', 0, true, '');

  INSERT INTO public.bbva_movimientos(
    id, organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, motivo_ignorar, importado_en
  ) VALUES
    (mov_a, org_a, cuenta_a, CURRENT_DATE, 'Dep A', 'REF-A', 0, 1000, 'hash-rol-a', 'Pendiente', '', now()),
    (mov_b, org_b, cuenta_b, CURRENT_DATE, 'Dep B', 'REF-B', 0, 2000, 'hash-rol-b', 'Pendiente', '', now());

  INSERT INTO public.cobranza_seguimiento(id, organization_id, factura_id, tipo, fecha) VALUES
    (seg_a, org_a, fac_a, 'llamada', CURRENT_DATE),
    (seg_b, org_b, fac_b, 'email',   CURRENT_DATE);

  -- ════════════════════════════════════════════════════════════════════════
  -- VENDEDOR (org_a) — nunca ve otra org
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(vendedor_a);
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'vendedor_a NO debe ver factura de org_b');
  SELECT count(*) INTO visible FROM public.cuentas_bancarias WHERE id = cuenta_b;
  PERFORM pg_temp.assert(visible = 0, 'vendedor_a NO debe ver cuenta_bancaria de org_b');
  -- No auto-escalada a super_admin
  PERFORM pg_temp.assert_insert_blocked(
    format('INSERT INTO public.user_roles(user_id, role) VALUES (%L, %L)', vendedor_a, 'super_admin'),
    'vendedor_a NO debe poder auto-asignarse super_admin'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- CONTADOR (org_a) — puede leer financiero de su org, NO otra org
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(contador_a);
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'contador_a debe ver factura de su org');
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'contador_a NO debe ver factura de org_b');
  -- INSERT cruzado bloqueado
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id, numero, fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado) VALUES (%L, %L, %L, %L, %L, %L, CURRENT_DATE, CURRENT_DATE+15, %L, 1, 0, 1, %L)',
      gen_random_uuid(), org_b, cli_b, 'HACK', emb_b, 'CTA-HACK', 'MXN', 'Emitida'
    ),
    'contador_a NO debe poder INSERT facturas en org_b'
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- TESORERO (org_a) — cuentas bancarias / bbva
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(tesorero_a);
  SELECT count(*) INTO visible FROM public.cuentas_bancarias WHERE id = cuenta_b;
  PERFORM pg_temp.assert(visible = 0, 'tesorero_a NO debe ver cuenta_bancaria de org_b');
  SELECT count(*) INTO visible FROM public.bbva_movimientos WHERE id = mov_b;
  PERFORM pg_temp.assert(visible = 0, 'tesorero_a NO debe ver bbva_movimientos de org_b');

  -- ════════════════════════════════════════════════════════════════════════
  -- EJECUTIVO_COBRANZA (org_a) — cobranza_seguimiento
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(cobranza_a);
  SELECT count(*) INTO visible FROM public.cobranza_seguimiento WHERE id = seg_b;
  PERFORM pg_temp.assert(visible = 0, 'cobranza_a NO debe ver cobranza_seguimiento de org_b');

  -- ════════════════════════════════════════════════════════════════════════
  -- SUPER_ADMIN (positivo) — ve datos de AMBAS orgs
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(super_u);
  SELECT count(*) INTO visible FROM public.facturas WHERE id IN (fac_a, fac_b);
  PERFORM pg_temp.assert(visible = 2, format('super_admin debe ver ambas facturas, vio %s', visible));
  SELECT count(*) INTO visible FROM public.cuentas_bancarias WHERE id IN (cuenta_a, cuenta_b);
  PERFORM pg_temp.assert(visible = 2, format('super_admin debe ver ambas cuentas bancarias, vio %s', visible));
  SELECT count(*) INTO visible FROM public.embarques WHERE id IN (emb_a, emb_b);
  PERFORM pg_temp.assert(visible = 2, format('super_admin debe ver ambos embarques, vio %s', visible));

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_roles_negocio: 13 aserciones OK';
END;
$$;

ROLLBACK;
