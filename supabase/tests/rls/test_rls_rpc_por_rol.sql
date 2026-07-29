-- ============================================================================
-- Suite RLS — RPCs sensibles: control por ROL y por TENANT (Ola 3)
-- ============================================================================
-- Complementa test_rls_rpc_financieras.sql (cross-tenant en lecturas) con
-- el eje de ESCRITURA: quién puede ejecutar RPCs privilegiadas.
--
-- Cubre:
--   1) can_view_financials / can_admin_tenant por rol de negocio.
--   2) _assert_writer: roles sin escritura reciben 42501.
--   3) aprobar_factura_proveedor:
--        a. rol sin permisos financieros → excepción
--        b. rol financiero de OTRA organización → excepción (guard tenant,
--           v13.322.2). Regresión: antes aprobaba facturas ajenas por UUID.
--        c. rol financiero de la MISMA organización → aprueba/rechaza
--   4) get_top_tarifas: exige membresía aunque no se pase organization_id.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_rpc_por_rol.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Helper local: espera que el SQL falle (cualquier excepción).
CREATE OR REPLACE FUNCTION pg_temp.assert_raises(_sql text, _msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE _sql;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;
  RAISE EXCEPTION 'RLS ROL FAIL: % — se esperaba excepción y no ocurrió', _msg;
END;
$$;

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  u_admin_a uuid := gen_random_uuid();   -- admin_org de A
  u_conta_a uuid := gen_random_uuid();   -- contador de A
  u_cs_a    uuid := gen_random_uuid();   -- customer_service de A (sin finanzas)
  u_conta_b uuid := gen_random_uuid();   -- contador de B (tenant ajeno)
  prov_a uuid := gen_random_uuid();
  cat_a  uuid := gen_random_uuid();
  fac1   uuid := gen_random_uuid();
  fac2   uuid := gen_random_uuid();
  v_estado text;
BEGIN
  -- ── Seed ──
  -- Los FK de user_roles/organization_members apuntan a auth.users, así que
  -- sembramos los usuarios primero. El trigger on_auth_user_created (si existe)
  -- autoprovisiona org + membresía y chocaría con los INSERT manuales.
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created'
  ) THEN
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  END IF;

  INSERT INTO auth.users(id, email) VALUES
    (u_admin_a, 'admin_a+rol@e2e.test'),
    (u_conta_a, 'conta_a+rol@e2e.test'),
    (u_cs_a,    'cs_a+rol@e2e.test'),
    (u_conta_b, 'conta_b+rol@e2e.test');

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass AND tgname = 'on_auth_user_created'
  ) THEN
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
  END IF;

  INSERT INTO public.organizations(id, nombre) VALUES
    (org_a, 'ROL RPC A'), (org_b, 'ROL RPC B');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, u_admin_a, 'admin_org'),
    (org_a, u_conta_a, 'contador'),
    (org_a, u_cs_a,    'customer_service'),
    (org_b, u_conta_b, 'contador');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (u_admin_a, 'admin_org'),
    (u_conta_a, 'contador'),
    (u_cs_a,    'customer_service'),
    (u_conta_b, 'contador');

  INSERT INTO public.proveedores(
    id, organization_id, nombre, rfc, contacto, email, telefono,
    moneda_preferida, dias_credito, categoria, tipo
  ) VALUES (
    prov_a, org_a, 'Proveedor ROL A', 'XAXX010101000', 'Contacto',
    'prov@test.local', '5555555555', 'MXN', 30, 'Logistico', 'Naviera'
  );

  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre)
  VALUES (cat_a, org_a, 'Categoría ROL A');

  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac1, org_a, prov_a, 'Proveedor ROL A', 'ROL-A-001', cat_a, 'MXN', 1000, 160, 1160, 'Vigente'),
    (fac2, org_a, prov_a, 'Proveedor ROL A', 'ROL-A-002', cat_a, 'MXN', 500,  80,  580,  'Vigente');

  -- ────────────────────────────────────────────────────────────────────────
  -- 1) Helpers de capacidades por rol
  -- ────────────────────────────────────────────────────────────────────────
  PERFORM pg_temp.assert(public.can_view_financials(u_conta_a),
    'contador SÍ debe poder ver finanzas');
  PERFORM pg_temp.assert(public.can_view_financials(u_admin_a),
    'admin_org SÍ debe poder ver finanzas');
  PERFORM pg_temp.assert(NOT public.can_view_financials(u_cs_a),
    'customer_service NO debe poder ver información financiera');

  PERFORM pg_temp.assert(public.can_admin_tenant(u_admin_a),
    'admin_org SÍ debe poder administrar el tenant');
  PERFORM pg_temp.assert(NOT public.can_admin_tenant(u_conta_a),
    'contador NO debe poder administrar el tenant');
  PERFORM pg_temp.assert(NOT public.can_admin_tenant(u_cs_a),
    'customer_service NO debe poder administrar el tenant');

  -- ────────────────────────────────────────────────────────────────────────
  -- 2) _assert_writer
  -- ────────────────────────────────────────────────────────────────────────
  PERFORM pg_temp.as_user(u_cs_a);
  PERFORM pg_temp.assert_raises(
    format('SELECT public._assert_writer(%L::uuid)', org_a),
    '_assert_writer debe rechazar a customer_service'
  );

  PERFORM pg_temp.as_user(u_conta_b);
  PERFORM pg_temp.assert_raises(
    format('SELECT public._assert_writer(%L::uuid)', org_a),
    '_assert_writer debe rechazar a un contador de otra organización'
  );

  -- ────────────────────────────────────────────────────────────────────────
  -- 3) aprobar_factura_proveedor
  -- ────────────────────────────────────────────────────────────────────────
  -- a. rol sin permisos financieros
  PERFORM pg_temp.as_user(u_cs_a);
  PERFORM pg_temp.assert_raises(
    format('SELECT public.aprobar_factura_proveedor(%L::uuid, false, ''sin permisos'')', fac1),
    'customer_service NO debe poder rechazar facturas de proveedor'
  );

  -- b. rol financiero de otra organización (guard tenant v13.322.2)
  PERFORM pg_temp.as_user(u_conta_b);
  PERFORM pg_temp.assert_raises(
    format('SELECT public.aprobar_factura_proveedor(%L::uuid, false, ''cross tenant'')', fac1),
    'contador de org_b NO debe poder tocar facturas de org_a'
  );

  PERFORM pg_temp.as_postgres();
  SELECT estado_aprobacion::text INTO v_estado
    FROM public.proveedor_facturas WHERE id = fac1;
  PERFORM pg_temp.assert(v_estado = 'pendiente',
    'la factura de org_a debe seguir pendiente tras los intentos no autorizados');

  -- c. contador de la misma organización sí puede rechazar
  PERFORM pg_temp.as_user(u_conta_a);
  PERFORM public.aprobar_factura_proveedor(fac2, false, 'rechazo de prueba');

  PERFORM pg_temp.as_postgres();
  SELECT estado_aprobacion::text INTO v_estado
    FROM public.proveedor_facturas WHERE id = fac2;
  PERFORM pg_temp.assert(v_estado = 'rechazada',
    'contador de la misma org SÍ debe poder rechazar la factura');

  -- ────────────────────────────────────────────────────────────────────────
  -- 4) get_top_tarifas exige membresía (aunque no se pase organization_id)
  -- ────────────────────────────────────────────────────────────────────────
  PERFORM pg_temp.as_user(u_conta_b);
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.get_top_tarifas(
        gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), CURRENT_DATE, NULL)) = 0,
    'get_top_tarifas sin membresía debe devolver 0 filas'
  );

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_rpc_por_rol: todas las aserciones pasaron';
END;
$$;

ROLLBACK;
