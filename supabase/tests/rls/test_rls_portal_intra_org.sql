-- ============================================================================
-- Suite RLS — Portal cliente: aislamiento INTRA-organización (H2)
-- ============================================================================
-- Verifica que dentro de la MISMA organización, un usuario del portal
-- (client_users → cli_a) NO puede ver facturas / proformas / documentos /
-- pagos del otro cliente (cli_b) de esa misma org. Es el vector clásico
-- de fuga en portales B2B multi-cliente.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_portal_intra_org.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a uuid := gen_random_uuid();
  admin_a uuid := gen_random_uuid();
  portal_a uuid := gen_random_uuid();  -- portal user ligado a cli_a
  portal_b uuid := gen_random_uuid();  -- portal user ligado a cli_b (control)
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  emb_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  prof_a uuid := gen_random_uuid();
  prof_b uuid := gen_random_uuid();
  doc_a uuid := gen_random_uuid();
  doc_b uuid := gen_random_uuid();
  pago_a uuid := gen_random_uuid();
  pago_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- Seed base (una sola org, dos clientes)
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS PORTAL A');

  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, admin_a, 'admin_org');

  INSERT INTO public.user_roles(user_id, role) VALUES
    (admin_a, 'admin_org'),
    (portal_a, 'cliente'),
    (portal_b, 'cliente')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cliente Portal A', 'XAXX010101000', 'a@test.local', org_a),
    (cli_b, 'Cliente Portal B', 'XAXX010101001', 'b@test.local', org_a);

  -- CADA portal user ligado SOLO a su cliente
  INSERT INTO public.client_users(cliente_id, user_id, organization_id) VALUES
    (cli_a, portal_a, org_a),
    (cli_b, portal_b, org_a);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo, estado, incoterm) VALUES
    (emb_a, 'ELPRT00001', cli_a, 'Cliente Portal A', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB'),
    (emb_b, 'ELPRT00002', cli_b, 'Cliente Portal B', org_a, 'Marítimo', 'Importación', 'Confirmado', 'FOB');

  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado,
    uuid_fiscal, timbrado_en
  ) VALUES
    (fac_a, org_a, cli_a, 'Cliente Portal A', emb_a, 'PRT-A-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 1000, 160, 1160, 'Emitida',
      gen_random_uuid()::text, now()),
    (fac_b, org_a, cli_b, 'Cliente Portal B', emb_b, 'PRT-B-001',
      CURRENT_DATE, CURRENT_DATE + 15, 'MXN', 5000, 800, 5800, 'Emitida',
      gen_random_uuid()::text, now());

  INSERT INTO public.proformas(
    id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente,
    numero, fecha_emision, subtotal_usd, iva_usd, total_usd,
    subtotal_mxn, iva_mxn, total_mxn, estado_proforma
  ) VALUES
    (prof_a, org_a, emb_a, cli_a, 'Cliente Portal A', 'ELPRT00001',
      'PRO-A-001', CURRENT_DATE, 100, 16, 116, 0, 0, 0, 'pendiente'),
    (prof_b, org_a, emb_b, cli_b, 'Cliente Portal B', 'ELPRT00002',
      'PRO-B-001', CURRENT_DATE, 900, 144, 1044, 0, 0, 0, 'pendiente');

  INSERT INTO public.documentos_embarque(id, embarque_id, nombre, estado, organization_id) VALUES
    (doc_a, emb_a, 'BL', 'Recibido', org_a),
    (doc_b, emb_b, 'BL', 'Recibido', org_a);

  INSERT INTO public.pagos_factura(
    id, factura_id, organization_id, fecha_pago, monto, moneda, tipo_cambio,
    monto_aplicado_factura, forma_pago, referencia, notas, diferencia_cambiaria_mxn
  ) VALUES
    (pago_a, fac_a, org_a, CURRENT_DATE, 500, 'MXN', 1, 500, 'Transferencia', 'REF-PA', '', 0),
    (pago_b, fac_b, org_a, CURRENT_DATE, 3000, 'MXN', 1, 3000, 'Transferencia', 'REF-PB', '', 0);

  -- ════════════════════════════════════════════════════════════════════════
  -- portal_a: sólo debe ver los recursos de cli_a
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_user(portal_a);

  -- Facturas
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 1, 'portal_a debe ver factura de su cliente (cli_a)');
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver factura de cli_b (intra-org)');
  SELECT count(*) INTO visible FROM public.facturas;
  PERFORM pg_temp.assert(visible = 1, format('portal_a vio %s facturas totales, esperaba 1', visible));

  -- Proformas
  SELECT count(*) INTO visible FROM public.proformas WHERE id = prof_b;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver proforma de cli_b');

  -- Documentos de embarque (vía embarque_id de otro cliente)
  SELECT count(*) INTO visible FROM public.documentos_embarque WHERE id = doc_b;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver documentos de embarque de cli_b');

  -- Pagos de factura
  SELECT count(*) INTO visible FROM public.pagos_factura WHERE id = pago_b;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver pagos de factura de cli_b');

  -- Embarques
  SELECT count(*) INTO visible FROM public.embarques WHERE id = emb_b;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver embarques de cli_b');

  -- Escritura: portal NO debe poder INSERT factura para el otro cliente
  PERFORM pg_temp.assert_insert_blocked(
    format(
      'INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id, numero, fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado) VALUES (%L, %L, %L, %L, %L, %L, CURRENT_DATE, CURRENT_DATE+15, %L, 1, 0, 1, %L)',
      gen_random_uuid(), org_a, cli_b, 'HACK', emb_b, 'PRT-HACK', 'MXN', 'Emitida'
    ),
    'portal_a NO debe poder crear facturas para cli_b'
  );

  -- Control: portal_b sí ve lo de cli_b (para asegurar que la policy no está deny-all)
  PERFORM pg_temp.as_user(portal_b);
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_b;
  PERFORM pg_temp.assert(visible = 1, 'portal_b (control) debe ver factura de su cliente cli_b');
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 0, 'portal_b NO debe ver factura de cli_a');

  -- ════════════════════════════════════════════════════════════════════════
  -- QA-R2: el portal NO debe ver registros en papelera (deleted_at)
  -- ════════════════════════════════════════════════════════════════════════
  PERFORM pg_temp.as_postgres();
  -- v13.782.1 — el guard N7 (`_assert_soft_delete_factura_sin_hijos`) prohíbe
  -- mandar a papelera una factura con pagos vigentes o emitida sin cancelar:
  -- replicamos el camino real (quitar pagos + cancelar) antes del soft-delete,
  -- que es lo único que verifica esta sección.
  -- v13.784.0 — la Ola E4 pasó `comisiones_devengadas.pago_factura_id` a
  -- ON DELETE RESTRICT: hay que soltar la comisión antes de borrar el pago.
  DELETE FROM public.comisiones_devengadas
   WHERE pago_factura_id IN (SELECT id FROM public.pagos_factura WHERE factura_id = fac_a);
  DELETE FROM public.pagos_factura WHERE factura_id = fac_a;
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = fac_a;
  UPDATE public.facturas            SET deleted_at = now() WHERE id = fac_a;

  UPDATE public.documentos_embarque SET deleted_at = now() WHERE id = doc_a;


  PERFORM pg_temp.as_user(portal_a);
  SELECT count(*) INTO visible FROM public.facturas WHERE id = fac_a;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver una factura en papelera');
  SELECT count(*) INTO visible FROM public.documentos_embarque WHERE id = doc_a;
  PERFORM pg_temp.assert(visible = 0, 'portal_a NO debe ver un documento en papelera');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE '✓ test_rls_portal_intra_org: 12 aserciones OK';
END;
$$;

ROLLBACK;
