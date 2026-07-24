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
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  prof_a uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  -- (gastos_embarque y cuentas_por_cobrar fueron retirados: no existen
  --  en migraciones ni en código; los bloques IF EXISTS antiguos enmascaraban
  --  esta cobertura cero. Si se reintroducen como tablas reales, añadir
  --  tests aquí sin guards.)
  visible int;
BEGIN
  -- Seed mínimo (bypass RLS como rol postgres)
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS FIN A'), (org_b, 'RLS FIN B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cliente Fin A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cliente Fin B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm)
  VALUES
    (emb_a, 'ELFIN00001', cli_a, 'Cliente Fin A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELFIN00002', cli_b, 'Cliente Fin B', org_b, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  -- =========================================================================
  -- TEST 1: facturas aislamiento
  -- =========================================================================
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac_a, org_a, cli_a, 'Cliente Fin A', emb_a, 'FA-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida'),
    (fac_b, org_b, cli_b, 'Cliente Fin B', emb_b, 'FB-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 2000, 320, 2320, 'Emitida');

  PERFORM pg_temp.as_user(user_a);
  SELECT count(*) INTO visible FROM public.facturas;
  PERFORM pg_temp.assert(visible = 1, format('user_a debe ver 1 factura, vio %s', visible));
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'user_a NO debe ver factura de org_b');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 2: proformas aislamiento
  -- =========================================================================
  INSERT INTO public.proformas(
    id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente,
    numero, fecha_emision, subtotal_usd, iva_usd, total_usd,
    subtotal_mxn, iva_mxn, total_mxn, estado_proforma
  ) VALUES
    (prof_a, org_a, emb_a, cli_a, 'Cliente Fin A', 'ELFIN00001',
      'PA-001', CURRENT_DATE, 100, 16, 116, 0, 0, 0, 'pendiente');

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.proformas WHERE id = prof_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver proforma de org_a');
  PERFORM pg_temp.as_postgres();

  -- =========================================================================
  -- TEST 3: cotizaciones aislamiento
  -- =========================================================================
  INSERT INTO public.cotizaciones(
    id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm, estado
  ) VALUES
    (cot_a, org_a, cli_a, 'Cliente Fin A', 'COT-RLS-A', 'Marítimo', 'Importación', 'FOB', 'Enviada');

  PERFORM pg_temp.as_user(user_b);
  SELECT count(*) INTO visible FROM public.cotizaciones WHERE id = cot_a;
  PERFORM pg_temp.assert(visible = 0, 'user_b NO debe ver cotización de org_a');
  PERFORM pg_temp.as_postgres();

  -- Nota (13.135.6): los bloques antiguos para `cuentas_por_cobrar` y
  -- `gastos_embarque` envolvían el test en `IF EXISTS (information_schema...)`.
  -- Esas tablas nunca llegaron a producción (no aparecen en ninguna migración
  -- ni código de la app), así que el `IF EXISTS` siempre era falso y los
  -- tests se saltaban silenciosamente — falso verde permanente. Eliminados.



  RAISE NOTICE 'RLS FINANCIERO: todas las aserciones pasaron';
END;
$$;

ROLLBACK;
