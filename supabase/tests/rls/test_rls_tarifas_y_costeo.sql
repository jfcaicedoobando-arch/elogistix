-- ============================================================================
-- Suite de pruebas de RLS — Tarifas, Costeo y Cumplimiento (Libre Carga)
-- ============================================================================
--
-- Cierra el gap #1 de riesgo de negocio: fuga de listas de precios y datos
-- de cumplimiento entre organizaciones. Cubre tablas no incluidas en las
-- suites previas:
--   - costeo_tarifas          (matriz de tarifas marítimas — IP del forwarder)
--   - costeo_rutas            (catálogo de rutas activas por org)
--   - proveedor_notas_credito (datos contables sensibles)
--   - auditoria_revisiones    (hallazgos de cumplimiento por embarque)
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_tarifas_y_costeo.sql
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
  -- Catálogos compartidos (no tienen organization_id)
  puerto_o uuid := gen_random_uuid();
  puerto_d uuid := gen_random_uuid();
  naviera_x uuid := gen_random_uuid();
  tipo_cont uuid := gen_random_uuid();
  -- Por-org
  prov_a uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  ag_a uuid := gen_random_uuid();
  ag_b uuid := gen_random_uuid();
  ruta_a uuid := gen_random_uuid();
  ruta_b uuid := gen_random_uuid();
  tar_a uuid := gen_random_uuid();
  tar_b uuid := gen_random_uuid();
  pf_a uuid := gen_random_uuid();
  pf_b uuid := gen_random_uuid();
  nc_a uuid := gen_random_uuid();
  nc_b uuid := gen_random_uuid();
  rev_a uuid := gen_random_uuid();
  rev_b uuid := gen_random_uuid();
  visible int;
BEGIN
  -- ===================== Seed base =====================
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS TAR A'), (org_b, 'RLS TAR B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id) VALUES
    (cli_a, 'Cli TAR A', 'XAXX010101000', 'a@test.local', org_a), (cli_b, 'Cli TAR B', 'XAXX010101001', 'b@test.local', org_b);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
  VALUES
    (emb_a, 'ELTAR00001', cli_a, 'Cli TAR A', org_a, 'Marítimo', 'Importación'),
    (emb_b, 'ELTAR00002', cli_b, 'Cli TAR B', org_b, 'Marítimo', 'Importación');

  -- Catálogos globales (sin organization_id): puertos, navieras, tipos_contenedor
  -- Usar códigos únicos del test para evitar colisión con seed/datos previos;
  -- si colisionara, ON CONFLICT DO NOTHING dejaría puerto_o/puerto_d sin fila
  -- (puerto_o no es el id real) y la FK de costeo_rutas explotaría.
  INSERT INTO public.puertos(id, code, name, country, activo) VALUES
    (puerto_o, 'TST-ORIG-' || substr(puerto_o::text, 1, 8), 'Test Origen', 'CN', true),
    (puerto_d, 'TST-DEST-' || substr(puerto_d::text, 1, 8), 'Test Destino', 'MX', true);
  INSERT INTO public.navieras(id, code, name, activo) VALUES
    (naviera_x, 'TST-' || substr(naviera_x::text, 1, 8), 'Tarifas Test Liner', true);
  INSERT INTO public.tipos_contenedor(id, code, name, activo) VALUES
    (tipo_cont, '40HC-' || substr(tipo_cont::text, 1, 8), '40 HC Test', true);

  -- Proveedores (necesarios para costeo_agentes y proveedor_facturas)
  INSERT INTO public.proveedores(
    id, nombre, rfc, contacto, email, telefono, moneda_preferida, organization_id, tipo, categoria
  ) VALUES
    (prov_a, 'Prov TAR A', 'RTA010101AAA', 'C', 'a@a', '555', 'USD', org_a, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_b, 'Prov TAR B', 'RTB010101BBB', 'C', 'b@b', '555', 'USD', org_b, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  -- Seed canonical presupuesto_categorias (categoria_presupuesto_id NOT NULL).
  PERFORM public.seed_presupuesto_categorias(org_a);
  PERFORM public.seed_presupuesto_categorias(org_b);

  INSERT INTO public.costeo_agentes(
    id, organization_id, proveedor_id, nombre, pais, dias_credito, activo
  ) VALUES
    (ag_a, org_a, prov_a, 'Agente A', 'CN', 30, true),
    (ag_b, org_b, prov_b, 'Agente B', 'CN', 30, true);

  INSERT INTO public.costeo_rutas(
    id, organization_id, puerto_origen_id, puerto_destino_id, activa
  ) VALUES
    (ruta_a, org_a, puerto_o, puerto_d, true),
    (ruta_b, org_b, puerto_o, puerto_d, true);

  -- =========================================================================
  -- TEST 1: costeo_rutas — aislamiento
  -- =========================================================================
  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.costeo_rutas WHERE id IN (ruta_a, ruta_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s costeo_rutas, esperaba 1', visible));

  -- =========================================================================
  -- TEST 2: costeo_tarifas — aislamiento (riesgo crítico: fuga de precios)
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta, estado
  ) VALUES
    (tar_a, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 1500, 14, CURRENT_DATE, CURRENT_DATE + 90, 'vigente'),
    (tar_b, org_b, ag_b, naviera_x, ruta_b, tipo_cont, 'USD', 9876, 14, CURRENT_DATE, CURRENT_DATE + 90, 'vigente');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas WHERE id IN (tar_a, tar_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s costeo_tarifas, esperaba 1', visible));

  -- TEST 3: el precio (flete_base) de la competencia jamás visible
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas WHERE flete_base = 9876;
  PERFORM pg_temp.assert(visible = 0,
    'User A vio flete_base de Org B (fuga de tarifa competitiva)');

  -- TEST 4: User A no puede UPDATE tarifa de Org B
  UPDATE public.costeo_tarifas SET flete_base = 1 WHERE id = tar_b;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas WHERE id = tar_b AND flete_base = 1;
  PERFORM pg_temp.assert(visible = 0, 'User A modificó tarifa de Org B (fuga RLS)');

  -- =========================================================================
  -- TEST 5: proveedor_notas_credito — aislamiento contable
  -- =========================================================================
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    fecha_emision, dias_credito, moneda, tipo_cambio_usd, subtotal, iva,
    retenciones, total, estado, categoria_presupuesto_id
  ) VALUES
    (pf_a, org_a, prov_a, 'Prov TAR A', 'PF-A-001', CURRENT_DATE, 30, 'MXN', 1, 1000, 160, 0, 1160, 'Vigente',
      (SELECT id FROM public.presupuesto_categorias WHERE organization_id = org_a AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1)),
    (pf_b, org_b, prov_b, 'Prov TAR B', 'PF-B-001', CURRENT_DATE, 30, 'MXN', 1, 5000, 800, 0, 5800, 'Vigente',
      (SELECT id FROM public.presupuesto_categorias WHERE organization_id = org_b AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1));


  INSERT INTO public.proveedor_notas_credito(
    id, organization_id, proveedor_factura_id, folio_nc, fecha, monto,
    moneda, motivo, descripcion, estado
  ) VALUES
    (nc_a, org_a, pf_a, 'NC-A-001', CURRENT_DATE, 200, 'MXN', 'Bonificacion', 'Desc TAR A', 'Borrador'),
    (nc_b, org_b, pf_b, 'NC-B-001', CURRENT_DATE, 4444, 'MXN', 'Bonificacion', 'Desc TAR B', 'Borrador');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.proveedor_notas_credito WHERE id IN (nc_a, nc_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s proveedor_notas_credito, esperaba 1', visible));

  -- TEST 6: monto de NC de la competencia nunca visible
  SELECT COUNT(*) INTO visible FROM public.proveedor_notas_credito WHERE monto = 4444;
  PERFORM pg_temp.assert(visible = 0,
    'User A vio monto de NC de Org B (fuga contable)');

  -- =========================================================================
  -- TEST 7: auditoria_revisiones — aislamiento de hallazgos de cumplimiento
  -- =========================================================================
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  INSERT INTO public.auditoria_revisiones(
    id, organization_id, embarque_id, regla, detalle_hash, detalle,
    responsable_email, asignado_por_email, estado_revision
  ) VALUES
    (rev_a, org_a, emb_a, 'falta_factura', 'hash-a', 'Detalle A', 'a@a', 'sys@sys', 'pendiente'),
    (rev_b, org_b, emb_b, 'sobrecosto',    'hash-b', 'Detalle B sensible', 'b@b', 'sys@sys', 'pendiente');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.auditoria_revisiones WHERE id IN (rev_a, rev_b);
  PERFORM pg_temp.assert(visible = 1,
    format('User A vio %s auditoria_revisiones, esperaba 1', visible));

  -- TEST 8: detalle del hallazgo de la competencia nunca visible
  SELECT COUNT(*) INTO visible FROM public.auditoria_revisiones WHERE detalle = 'Detalle B sensible';
  PERFORM pg_temp.assert(visible = 0,
    'User A vio detalle de auditoria_revisiones de Org B');

  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE '✓ test_rls_tarifas_y_costeo: 8 aserciones OK';
END;
$$;

ROLLBACK;
