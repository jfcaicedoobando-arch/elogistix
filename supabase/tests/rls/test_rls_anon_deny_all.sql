-- ============================================================================
-- Suite RLS — Deny-all para anon (H5)
-- ============================================================================
-- Un cliente sin sesión (rol `anon`) NO debe poder leer NINGUNA fila de
-- tablas de negocio, incluso si la columna organization_id es NULL, incluso
-- si la tabla tiene una policy authenticated-only. También verifica que los
-- INSERT anónimos estén bloqueados. Se apoya en la whitelist real de tablas
-- que sí toleran acceso anónimo (rate limit, tokens públicos, catálogos SAT).
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

-- Helper local: setea rol anon con jwt.claims correspondiente.
CREATE OR REPLACE FUNCTION pg_temp.as_anon() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
  PERFORM set_config('role', 'anon', true);
END;
$$;

DO $$
DECLARE
  org_x uuid := gen_random_uuid();
  admin_x uuid := gen_random_uuid();
  cli_x uuid := gen_random_uuid();
  emb_x uuid := gen_random_uuid();
  fac_x uuid := gen_random_uuid();
  prov_x uuid := gen_random_uuid();
  -- Tablas sensibles que jamás debe leer anon.
  sensitive text[] := ARRAY[
    'clientes','embarques','facturas','proformas','pagos_factura',
    'proveedores','proveedor_facturas','pagos_proveedor','anticipos_proveedor',
    'cuentas_bancarias','bbva_movimientos','cobranza_seguimiento',
    'cotizaciones','cotizacion_costos','cotizacion_costos_historico',
    'documentos_embarque','notas_embarque','user_roles','organization_members',
    'organizations','facturapi_credenciales','costeo_tarifas',
    'costeo_navieras_condiciones','crm_leads','crm_oportunidades'
  ];
  t text;
  visible int;
BEGIN
  -- Seed defensivo
  INSERT INTO public.organizations(id, nombre) VALUES (org_x, 'RLS ANON');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_x, admin_x, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (admin_x, 'admin_org');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_x, 'Cli Anon', 'XAXX010101000', 'x@test.local', org_x);
  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_x, 'ELANN00001', cli_x, 'Cli Anon', org_x, 'Marítimo', 'Importación', 'Confirmado', 'FOB');
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac_x, org_x, cli_x, 'Cli Anon', emb_x, 'ANN-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida');
  INSERT INTO public.proveedores(id, nombre, organization_id, tipo, categoria) VALUES
    (prov_x, 'Prov Anon', org_x, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  -- Bajar a anon
  PERFORM pg_temp.as_anon();

  -- Sweep de SELECT: cada tabla debe devolver 0 filas visibles
  FOREACH t IN ARRAY sensitive LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO visible;
      PERFORM pg_temp.assert(
        visible = 0,
        format('anon vio %s filas en public.%s (fuga)', visible, t)
      );
    END IF;
  END LOOP;

  -- INSERT anon → debe bloquearse
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES (%L, %L, %L, %L, %L)',
      gen_random_uuid(), 'ANON HACK', 'XAXX010101999', 'hack@x', org_x
    ),
    'anon NO debe poder INSERT en clientes'
  );
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.user_roles(user_id, role) VALUES (%L, %L)',
      gen_random_uuid(), 'super_admin'
    ),
    'anon NO debe poder INSERT en user_roles (escalada catastrófica)'
  );

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_anon_deny_all: sweep OK sobre % tablas + 2 INSERT bloqueados', array_length(sensitive, 1);
END;
$$;

ROLLBACK;
