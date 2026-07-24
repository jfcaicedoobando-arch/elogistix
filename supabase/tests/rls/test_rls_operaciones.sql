-- ============================================================================
-- Suite de pruebas de RLS — Operaciones + Catálogos (Libre Carga)
-- ============================================================================
--
-- Cobertura adicional sobre tablas no incluidas en suites previos:
--   - proveedores            (catálogo CxP)
--   - conceptos_venta        (líneas de venta por embarque)
--   - conceptos_costo        (líneas de costo por embarque)
--   - conceptos_factura      (líneas de factura)
--   - embarque_contenedores  (operativa marítima)
--   - eventos_embarque       (timeline)
--   - tracking_externo       (integraciones de tracking)
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_operaciones.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. ROLLBACK al final.
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
  prov_a uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  cv_a uuid := gen_random_uuid();
  cv_b uuid := gen_random_uuid();
  cc_a uuid := gen_random_uuid();
  cc_b uuid := gen_random_uuid();
  fac_a uuid := gen_random_uuid();
  fac_b uuid := gen_random_uuid();
  cf_a uuid := gen_random_uuid();
  cf_b uuid := gen_random_uuid();
  cont_a uuid := gen_random_uuid();
  cont_b uuid := gen_random_uuid();
  evt_a uuid := gen_random_uuid();
  evt_b uuid := gen_random_uuid();
  trk_a uuid := gen_random_uuid();
  trk_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- Seed base
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS OPS A'), (org_b, 'RLS OPS B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli OPS A', 'XAXX010101000', 'a@test.local', org_a), (cli_b, 'Cli OPS B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
  VALUES
    (emb_a, 'ELOPS00001', cli_a, 'Cli OPS A', org_a, 'Marítimo', 'Importación'),
    (emb_b, 'ELOPS00002', cli_b, 'Cli OPS B', org_b, 'Marítimo', 'Importación');

  -- =========================================================================
  -- TEST 1: proveedores — aislamiento
  -- =========================================================================
  INSERT INTO public.proveedores(
    id, nombre, rfc, contacto, email, telefono, moneda_preferida, organization_id, tipo, categoria
  ) VALUES
    (prov_a, 'Prov A', 'RFCA010101AAA', 'C', 'a@a', '555', 'USD', org_a, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_b, 'Prov B', 'RFCB010101BBB', 'C', 'b@b', '555', 'MXN', org_b, 'Naviera'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.proveedores WHERE id IN (prov_a, prov_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s proveedores, esperaba 1', visible));

  -- TEST 2: User A no puede UPDATE proveedor de Org B
  UPDATE public.proveedores SET nombre = 'HACKED' WHERE id = prov_b;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT COUNT(*) INTO visible FROM public.proveedores WHERE id = prov_b AND nombre = 'HACKED';
  PERFORM pg_temp.assert(visible = 0, 'User A modificó proveedor de Org B (fuga RLS)');

  -- =========================================================================
  -- TEST 3: conceptos_venta — aislamiento
  -- =========================================================================
  INSERT INTO public.conceptos_venta(
    id, embarque_id, descripcion, cantidad, precio_unitario, moneda, total,
    organization_id, estado_facturacion, aplica_iva, tasa_iva_aplicada, origen
  ) VALUES
    (cv_a, emb_a, 'Flete', 1, 1000, 'USD', 1000, org_a, 'pendiente', false, 0, 'manual'),
    (cv_b, emb_b, 'Flete', 1, 9999, 'USD', 9999, org_b, 'pendiente', false, 0, 'manual');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.conceptos_venta WHERE id IN (cv_a, cv_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s conceptos_venta, esperaba 1', visible));
  SELECT COUNT(*) INTO visible FROM public.conceptos_venta WHERE total = 9999;
  PERFORM pg_temp.assert(visible = 0, 'User A vio venta de Org B');

  -- =========================================================================
  -- TEST 4: conceptos_costo — aislamiento
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.conceptos_costo(
    id, embarque_id, proveedor_nombre, concepto, monto, moneda,
    estado_liquidacion, organization_id, tasa_iva_aplicada, origen
  ) VALUES
    (cc_a, emb_a, 'Prov A', 'Flete', 500, 'USD', 'Pendiente', org_a, 0, 'manual'),
    (cc_b, emb_b, 'Prov B', 'Flete', 7777, 'USD', 'Pendiente', org_b, 0, 'manual');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.conceptos_costo WHERE id IN (cc_a, cc_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s conceptos_costo, esperaba 1', visible));
  SELECT COUNT(*) INTO visible FROM public.conceptos_costo WHERE monto = 7777;
  PERFORM pg_temp.assert(visible = 0, 'User A vio costo de Org B (margen expuesto)');

  -- =========================================================================
  -- TEST 5: conceptos_factura — aislamiento vía factura
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.facturas(
    id, organization_id, cliente_id, cliente_nombre, embarque_id, numero,
    fecha_emision, fecha_vencimiento, moneda, subtotal, iva, total, estado
  ) VALUES
    (fac_a, org_a, cli_a, 'Cli OPS A', emb_a, 'F-OPS-A', CURRENT_DATE, CURRENT_DATE+30, 'MXN', 1000, 160, 1160, 'Emitida'),
    (fac_b, org_b, cli_b, 'Cli OPS B', emb_b, 'F-OPS-B', CURRENT_DATE, CURRENT_DATE+30, 'MXN', 5000, 800, 5800, 'Emitida');
  INSERT INTO public.conceptos_factura(id, factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id) VALUES
    (cf_a, fac_a, 'Servicio', 1, 1000, 'MXN', 1000, org_a),
    (cf_b, fac_b, 'Servicio', 1, 5000, 'MXN', 5000, org_b);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.conceptos_factura WHERE id IN (cf_a, cf_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s conceptos_factura, esperaba 1', visible));

  -- =========================================================================
  -- TEST 6: embarque_contenedores — aislamiento
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.embarque_contenedores(
    id, embarque_id, organization_id, numero_contenedor, tipo_contenedor,
    bl_house, peso_kg, volumen_m3, piezas, orden
  ) VALUES
    (cont_a, emb_a, org_a, 'MSCU1234567', '40HC', 'BL-A', 18000, 60, 100, 1),
    (cont_b, emb_b, org_b, 'MSCU7654321', '20GP', 'BL-B', 12000, 28, 50, 1);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.embarque_contenedores WHERE id IN (cont_a, cont_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s contenedores, esperaba 1', visible));

  -- =========================================================================
  -- TEST 7: eventos_embarque — aislamiento timeline
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.eventos_embarque(
    id, embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id
  ) VALUES
    (evt_a, emb_a, 'Zarpe', 'Booking confirmado', 'MX', NOW(), 'a@a', org_a),
    (evt_b, emb_b, 'Zarpe', 'Booking confirmado', 'MX', NOW(), 'b@b', org_b);

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.eventos_embarque WHERE id IN (evt_a, evt_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s eventos_embarque, esperaba 1', visible));

  -- =========================================================================
  -- TEST 8: tracking_externo — aislamiento
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.tracking_externo(
    id, embarque_id, organization_id, provider, request_number, request_type, scac, status
  ) VALUES
    (trk_a, emb_a, org_a, 'searates', 'MSCU1234567', 'CT', 'MSCU', 'active'),
    (trk_b, emb_b, org_b, 'searates', 'MSCU7654321', 'CT', 'MSCU', 'active');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.tracking_externo WHERE id IN (trk_a, trk_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s tracking_externo, esperaba 1', visible));

  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE '✓ test_rls_operaciones: 9 aserciones OK';
END;
$$;

ROLLBACK;
