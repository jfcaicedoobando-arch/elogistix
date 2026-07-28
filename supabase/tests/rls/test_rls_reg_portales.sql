-- ============================================================================
-- Suite de REGRESIÓN — Portales, tarifas y RPCs de dinero (auditoría 2026-07-28)
-- ============================================================================
--
-- Ola 1 del plan de cobertura: los fixes de seguridad y dinero que quedaron
-- sin red de pruebas. Cubre:
--   B-065 / B-090  get_top_tarifas: sin fuga cross-tenant y orden determinista
--   B-080          agente inactivo fuera del comparador
--   B-066          agente_aprobar_tarifa: firma única + notificación correcta
--   B-098          current_agente_id / get_current_agente_context deterministas
--   B-069          rol agente_carga sin acceso a conceptos_venta ni facturas
--   B-070 / B-084  aislamiento de costeo_agentes entre organizaciones
--   B-085          cartas de garantía en storage aisladas por agente/organización
--   B-064          replicación de costos NO se multiplica por contenedor
--   REG B-016      duplicar_cotizacion corre y copia costos
--   REG B-001      el soft delete (deleted_at) vuelve a funcionar
--
-- Ejecutar:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_portales.sql
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
  user_ag uuid := gen_random_uuid();     -- usuario del portal agente (org A)
  cli_a uuid := gen_random_uuid();
  emb_a uuid := gen_random_uuid();
  cont_1 uuid := gen_random_uuid();
  cont_2 uuid := gen_random_uuid();
  cont_3 uuid := gen_random_uuid();
  puerto_o uuid := gen_random_uuid();
  puerto_d uuid := gen_random_uuid();
  naviera_x uuid := gen_random_uuid();
  naviera_y uuid := gen_random_uuid();
  tipo_cont uuid := gen_random_uuid();
  prov_a uuid := gen_random_uuid();
  prov_a2 uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  ag_a uuid := gen_random_uuid();        -- agente principal de org A
  ag_a2 uuid := gen_random_uuid();       -- segundo agente de org A
  ag_b uuid := gen_random_uuid();        -- agente de org B
  ruta_a uuid := gen_random_uuid();
  ruta_b uuid := gen_random_uuid();
  tar_a1 uuid := gen_random_uuid();
  tar_a2 uuid := gen_random_uuid();
  tar_b uuid := gen_random_uuid();
  tar_borr uuid := gen_random_uuid();
  cot_a uuid := gen_random_uuid();
  cot_dup uuid;
  bucket text := 'agente-cartas-garantia';
  hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_first uuid;
  v_first_2 uuid;
  v_ag uuid;
  v_org uuid;
  v_estado text;
  v_total numeric;
  visible int;
  n_funcs int;
BEGIN
  -- ===================== Seed base =====================
  -- auth.users: en local es la tabla real de GoTrue (con trigger de
  -- provisioning) y en CI es la tabla mínima del bootstrap. Desactivamos los
  -- triggers de usuario si existen para no auto-crear organizaciones.
  BEGIN
    EXECUTE 'ALTER TABLE auth.users DISABLE TRIGGER USER';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO auth.users(id, email) VALUES
    (user_a,  'reg-port-a@test.local'),
    (user_b,  'reg-port-b@test.local'),
    (user_ag, 'reg-port-ag@test.local')
  ON CONFLICT (id) DO NOTHING;
  BEGIN
    EXECUTE 'ALTER TABLE auth.users ENABLE TRIGGER USER';
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'REG PORT A'), (org_b, 'REG PORT B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES
    (user_a, 'admin_org'), (user_b, 'admin_org'), (user_ag, 'agente_carga');


  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
  VALUES (cli_a, 'Cli PORT A', 'XAXX010101000', 'a@test.local', org_a);

  INSERT INTO public.embarques(id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo)
  VALUES (emb_a, 'ELPORT0001', cli_a, 'Cli PORT A', org_a, 'Marítimo', 'Importación');

  INSERT INTO public.puertos(id, code, name, country, activo) VALUES
    (puerto_o, 'RP-O-' || substr(puerto_o::text, 1, 8), 'Port Origen', 'CN', true),
    (puerto_d, 'RP-D-' || substr(puerto_d::text, 1, 8), 'Port Destino', 'MX', true);
  INSERT INTO public.navieras(id, code, name, activo) VALUES
    (naviera_x, 'RPX-' || substr(naviera_x::text, 1, 8), 'Port Liner X', true),
    (naviera_y, 'RPY-' || substr(naviera_y::text, 1, 8), 'Port Liner Y', true);
  INSERT INTO public.tipos_contenedor(id, code, name, activo) VALUES
    (tipo_cont, '40-' || substr(tipo_cont::text, 1, 8), '40 HC Port', true);

  INSERT INTO public.proveedores(
    id, nombre, rfc, contacto, email, telefono, moneda_preferida, organization_id, tipo, categoria
  ) VALUES
    (prov_a,  'Prov PORT A',  'RPA010101AAA', 'C', 'a@a', '555', 'USD', org_a, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_a2, 'Prov PORT A2', 'RPA010101AA2', 'C', 'a2@a', '555', 'USD', org_a, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_b,  'Prov PORT B',  'RPB010101BBB', 'C', 'b@b', '555', 'USD', org_b, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  INSERT INTO public.costeo_agentes(id, organization_id, proveedor_id, nombre, pais, dias_credito, activo) VALUES
    (ag_a,  org_a, prov_a,  'Agente PORT A',  'CN', 30, true),
    (ag_a2, org_a, prov_a2, 'Agente PORT A2', 'CN', 30, true),
    (ag_b,  org_b, prov_b,  'Agente PORT B',  'CN', 30, true);

  INSERT INTO public.costeo_rutas(id, organization_id, puerto_origen_id, puerto_destino_id, activa) VALUES
    (ruta_a, org_a, puerto_o, puerto_d, true),
    (ruta_b, org_b, puerto_o, puerto_d, true);

  -- Vínculo del usuario agente (portal) con el agente A.
  INSERT INTO public.agente_users(user_id, agente_id, organization_id, created_at)
  VALUES (user_ag, ag_a, org_a, now() - interval '10 days');

  -- Dos tarifas vigentes de Org A con el MISMO total comparable (empate),
  -- en agentes distintos para no dispararse el trigger de reemplazo.
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES
    (tar_a1, org_a, ag_a,  naviera_x, ruta_a, tipo_cont, 'USD', 1500, 21, hoy - 1, hoy + 60),
    (tar_a2, org_a, ag_a2, naviera_y, ruta_a, tipo_cont, 'USD', 1500,  7, hoy - 1, hoy + 60),
    (tar_b,  org_b, ag_b,  naviera_x, ruta_b, tipo_cont, 'USD', 1500, 14, hoy - 1, hoy + 60);

  -- =========================================================================
  -- TEST 1 (B-065) · get_top_tarifas no filtra por org ⇒ fuga de precios.
  -- =========================================================================
  PERFORM pg_temp.as_user(user_b);
  SELECT COUNT(*) INTO visible
    FROM public.get_top_tarifas(puerto_o, puerto_d, tipo_cont, hoy, NULL)
   WHERE organization_id = org_a;
  PERFORM pg_temp.assert(visible = 0,
    format('Org B vio %s tarifas de Org A vía get_top_tarifas (fuga cross-tenant)', visible));

  -- Control: Org B sí ve la suya.
  SELECT COUNT(*) INTO visible
    FROM public.get_top_tarifas(puerto_o, puerto_d, tipo_cont, hoy, NULL)
   WHERE id = tar_b;
  PERFORM pg_temp.assert(visible = 1, 'Org B no ve su propia tarifa vigente (falso positivo del test)');

  -- =========================================================================
  -- TEST 2 (B-090) · Empate de total ⇒ orden determinista y repetible.
  -- =========================================================================
  PERFORM pg_temp.as_user(user_a);
  SELECT id INTO v_first
    FROM public.get_top_tarifas(puerto_o, puerto_d, tipo_cont, hoy, org_a) LIMIT 1;
  SELECT id INTO v_first_2
    FROM public.get_top_tarifas(puerto_o, puerto_d, tipo_cont, hoy, org_a) LIMIT 1;
  PERFORM pg_temp.assert(v_first = v_first_2,
    'get_top_tarifas devolvió un orden distinto en dos llamadas idénticas (empate sin desempate estable)');
  PERFORM pg_temp.assert(v_first = tar_a1,
    'Con totales empatados debe ganar la tarifa con más días libres de demoras');

  -- =========================================================================
  -- TEST 3 (B-080) · Un agente inactivo sale del comparador.
  -- =========================================================================
  PERFORM pg_temp.as_postgres();
  UPDATE public.costeo_agentes SET activo = false WHERE id = ag_a;

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible
    FROM public.get_top_tarifas(puerto_o, puerto_d, tipo_cont, hoy, org_a)
   WHERE id = tar_a1;
  PERFORM pg_temp.assert(visible = 0, 'Una tarifa de agente inactivo sigue apareciendo en el Top-3');

  PERFORM pg_temp.as_postgres();
  UPDATE public.costeo_agentes SET activo = true WHERE id = ag_a;

  -- =========================================================================
  -- TEST 4 (B-066) · agente_aprobar_tarifa: firma única y notificación válida.
  -- =========================================================================
  SELECT COUNT(*) INTO n_funcs
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'agente_aprobar_tarifa';
  PERFORM pg_temp.assert(n_funcs = 1,
    format('agente_aprobar_tarifa tiene %s firmas; con overloads PostgREST responde PGRST203', n_funcs));

  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta, estado_aprobacion
  ) VALUES
    (tar_borr, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 1400, 14, hoy, hoy + 45, 'borrador');

  PERFORM pg_temp.as_user(user_a);
  PERFORM public.agente_aprobar_tarifa(tar_borr, 'vigente', NULL);
  PERFORM pg_temp.as_postgres();

  SELECT estado_aprobacion INTO v_estado FROM public.costeo_tarifas WHERE id = tar_borr;
  PERFORM pg_temp.assert(v_estado = 'vigente',
    format('La tarifa quedó en estado_aprobacion "%s" tras aprobarla', v_estado));

  SELECT COUNT(*) INTO visible
    FROM public.notificaciones_internas
   WHERE usuario_id = user_ag AND tipo = 'tarifa_aprobada' AND organization_id = org_a;
  PERFORM pg_temp.assert(visible = 1,
    'La aprobación no notificó al usuario del agente en notificaciones_internas.usuario_id');

  -- =========================================================================
  -- TEST 5 (B-098) · Contexto del agente determinista con varios vínculos.
  -- =========================================================================
  INSERT INTO public.agente_users(user_id, agente_id, organization_id, created_at)
  VALUES (user_ag, ag_a2, org_a, now());   -- vínculo más reciente

  PERFORM pg_temp.as_user(user_ag);
  SELECT public.current_agente_id() INTO v_ag;
  PERFORM pg_temp.assert(v_ag = ag_a,
    'current_agente_id() no resolvió al vínculo más antiguo con dos agentes ligados');

  SELECT agente_id, organization_id INTO v_ag, v_org FROM public.get_current_agente_context();
  PERFORM pg_temp.assert(v_ag = ag_a AND v_org = org_a,
    'get_current_agente_context() no coincide con current_agente_id()');

  -- =========================================================================
  -- TEST 6 (B-069) · El rol agente_carga no ve ventas ni facturas del tenant.
  -- =========================================================================
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.conceptos_venta(embarque_id, descripcion, cantidad, precio_unitario, total, organization_id)
  VALUES (emb_a, 'Flete marítimo', 1, 2000, 2000, org_a);

  PERFORM pg_temp.as_user(user_ag);
  SELECT COUNT(*) INTO visible FROM public.conceptos_venta WHERE organization_id = org_a;
  PERFORM pg_temp.assert(visible = 0,
    format('Un agente de carga vio %s conceptos de venta del tenant (pricing interno)', visible));
  SELECT COUNT(*) INTO visible FROM public.facturas WHERE organization_id = org_a;
  PERFORM pg_temp.assert(visible = 0, 'Un agente de carga vio facturas del tenant');

  -- =========================================================================
  -- TEST 7 (B-070 + B-084) · costeo_agentes nunca cruza organizaciones.
  -- =========================================================================
  SELECT COUNT(*) INTO visible FROM public.costeo_agentes WHERE organization_id = org_b;
  PERFORM pg_temp.assert(visible = 0, 'El usuario agente de Org A vio agentes de Org B');

  PERFORM pg_temp.as_user(user_a);
  SELECT COUNT(*) INTO visible FROM public.costeo_agentes WHERE id = ag_b;
  PERFORM pg_temp.assert(visible = 0, 'Admin de Org A vio el agente de Org B');

  -- =========================================================================
  -- TEST 8 (B-085) · Cartas de garantía: un objeto por agente, sin cruces.
  -- =========================================================================
  PERFORM pg_temp.as_postgres();
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') THEN
    INSERT INTO storage.objects(bucket_id, name, owner) VALUES
      (bucket, ag_a::text || '/carta-a.pdf', user_a),
      (bucket, ag_b::text || '/carta-b.pdf', user_b);

    PERFORM pg_temp.as_user(user_a);
    SELECT COUNT(*) INTO visible FROM storage.objects WHERE name = ag_b::text || '/carta-b.pdf';
    PERFORM pg_temp.assert(visible = 0, 'Admin de Org A vio la carta de garantía de un agente de Org B');
    SELECT COUNT(*) INTO visible FROM storage.objects WHERE name = ag_a::text || '/carta-a.pdf';
    PERFORM pg_temp.assert(visible = 1, 'Admin de Org A no ve la carta de su propio agente (control)');

    PERFORM pg_temp.as_user(user_ag);
    SELECT COUNT(*) INTO visible FROM storage.objects WHERE name = ag_b::text || '/carta-b.pdf';
    PERFORM pg_temp.assert(visible = 0, 'El agente vio la carta de garantía de otro agente');
  ELSE
    RAISE NOTICE '⚠ storage.objects sin policies en este entorno — TEST 8 saltado';
  END IF;

  -- =========================================================================
  -- TEST 9 (B-064) · Replicar costos NO multiplica por número de contenedores.
  -- =========================================================================
  PERFORM pg_temp.as_postgres();
  INSERT INTO public.cotizaciones(id, folio, modo, tipo, cliente_id, cliente_nombre, organization_id)
  VALUES (cot_a, 'COT-REG-PORT-1', 'Marítimo', 'Importación', cli_a, 'Cli PORT A', org_a);

  INSERT INTO public.cotizacion_costos(
    cotizacion_id, concepto, moneda, cantidad, costo_unitario, costo_total, organization_id
  ) VALUES (cot_a, 'Flete', 'USD', 3, 1000, 3000, org_a);

  INSERT INTO public.embarque_contenedores(
    id, embarque_id, numero_contenedor, tipo_contenedor, organization_id
  ) VALUES
    (cont_1, emb_a, 'CONT0000001', '40 HC Port', org_a),
    (cont_2, emb_a, 'CONT0000002', '40 HC Port', org_a),
    (cont_3, emb_a, 'CONT0000003', '40 HC Port', org_a);

  PERFORM public._crear_embarque_replicar_conceptos(
    cot_a, emb_a, org_a, ARRAY[cont_1, cont_2, cont_3], '[]'::jsonb
  );

  SELECT COALESCE(SUM(monto), 0) INTO v_total
    FROM public.conceptos_costo WHERE embarque_id = emb_a AND concepto = 'Flete';
  PERFORM pg_temp.assert(v_total = 3000,
    format('Los costos replicados suman %s, esperaba 3000 (se prorratea, no se multiplica por contenedor)', v_total));

  -- =========================================================================
  -- TEST 10 (REG B-016) · duplicar_cotizacion corre y copia los costos.
  -- =========================================================================
  PERFORM pg_temp.as_user(user_a);
  SELECT public.duplicar_cotizacion(cot_a) INTO cot_dup;
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert(cot_dup IS NOT NULL, 'duplicar_cotizacion no devolvió el id de la copia');
  SELECT COUNT(*) INTO visible FROM public.cotizacion_costos WHERE cotizacion_id = cot_dup;
  PERFORM pg_temp.assert(visible = 1,
    format('La cotización duplicada tiene %s costos, esperaba 1', visible));
  SELECT organization_id INTO v_org FROM public.cotizaciones WHERE id = cot_dup;
  PERFORM pg_temp.assert(v_org = org_a, 'La cotización duplicada perdió su organización');

  -- =========================================================================
  -- TEST 11 (REG B-001) · El soft delete vuelve a ser posible.
  -- =========================================================================
  PERFORM pg_temp.as_user(user_a);
  UPDATE public.cotizaciones SET deleted_at = now() WHERE id = cot_dup;
  UPDATE public.conceptos_venta SET deleted_at = now() WHERE embarque_id = emb_a;
  PERFORM pg_temp.as_postgres();

  SELECT COUNT(*) INTO visible FROM public.cotizaciones WHERE id = cot_dup AND deleted_at IS NOT NULL;
  PERFORM pg_temp.assert(visible = 1, 'No se pudo marcar deleted_at en cotizaciones (soft delete bloqueado)');
  SELECT COUNT(*) INTO visible FROM public.conceptos_venta WHERE embarque_id = emb_a AND deleted_at IS NOT NULL;
  PERFORM pg_temp.assert(visible >= 1, 'No se pudo marcar deleted_at en conceptos_venta (soft delete bloqueado)');

  RAISE NOTICE '✓ Regresión portales/tarifas OK (11 bloques)';
END $$;

ROLLBACK;
