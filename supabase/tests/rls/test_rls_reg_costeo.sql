-- ============================================================================
-- Suite de REGRESIÓN — Costeo / Tarifas (auditoría portales 2026-07-28)
-- ============================================================================
--
-- Los fixes SQL de la ola de costeo (reemplazo atómico de tarifas, estado
-- "vencida" derivado, agente forzado a borrador, coherencia agente↔organización
-- y comparabilidad de la vista) no tenían red de seguridad: cualquier migración
-- posterior podía revertirlos en silencio. Esta suite los congela.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_costeo.sql
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
  puerto_o uuid := gen_random_uuid();
  puerto_d uuid := gen_random_uuid();
  naviera_x uuid := gen_random_uuid();
  tipo_cont uuid := gen_random_uuid();
  prov_a uuid := gen_random_uuid();
  prov_b uuid := gen_random_uuid();
  ag_a uuid := gen_random_uuid();
  ag_b uuid := gen_random_uuid();
  ruta_a uuid := gen_random_uuid();
  ruta_b uuid := gen_random_uuid();
  t_vieja uuid := gen_random_uuid();
  t_nueva uuid := gen_random_uuid();
  t_borrador uuid := gen_random_uuid();
  t_vencida uuid := gen_random_uuid();
  t_otra_org uuid := gen_random_uuid();
  hoy date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  v_estado text;
  v_reemplazada_por uuid;
  v_org uuid;
  v_total numeric;
  v_recargos numeric;
  visible int;
BEGIN
  -- ===================== Seed base =====================
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'REG COST A'), (org_b, 'REG COST B');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES
    (org_a, user_a, 'admin_org'), (org_b, user_b, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (user_a, 'admin_org'), (user_b, 'admin_org');

  INSERT INTO public.puertos(id, code, name, country, activo) VALUES
    (puerto_o, 'RC-O-' || substr(puerto_o::text, 1, 8), 'Reg Origen', 'CN', true),
    (puerto_d, 'RC-D-' || substr(puerto_d::text, 1, 8), 'Reg Destino', 'MX', true);
  INSERT INTO public.navieras(id, code, name, activo) VALUES
    (naviera_x, 'RC-' || substr(naviera_x::text, 1, 8), 'Reg Liner', true);
  INSERT INTO public.tipos_contenedor(id, code, name, activo) VALUES
    (tipo_cont, '40-' || substr(tipo_cont::text, 1, 8), '40 HC Reg', true);

  INSERT INTO public.proveedores(
    id, nombre, rfc, contacto, email, telefono, moneda_preferida, organization_id, tipo, categoria
  ) VALUES
    (prov_a, 'Prov REG A', 'RCA010101AAA', 'C', 'a@a', '555', 'USD', org_a, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor),
    (prov_b, 'Prov REG B', 'RCB010101BBB', 'C', 'b@b', '555', 'USD', org_b, 'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor);

  INSERT INTO public.costeo_agentes(id, organization_id, proveedor_id, nombre, pais, dias_credito, activo)
  VALUES (ag_a, org_a, prov_a, 'Agente REG A', 'CN', 30, true),
         (ag_b, org_b, prov_b, 'Agente REG B', 'CN', 30, true);

  INSERT INTO public.costeo_rutas(id, organization_id, puerto_origen_id, puerto_destino_id, activa)
  VALUES (ruta_a, org_a, puerto_o, puerto_d, true),
         (ruta_b, org_b, puerto_o, puerto_d, true);

  -- =========================================================================
  -- TEST 1 · Reemplazo atómico: una tarifa nueva vigente marca la anterior
  --          como "reemplazada" y guarda el puntero `reemplazada_por`.
  -- =========================================================================
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES
    (t_vieja, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 1500, 14, hoy - 10, hoy + 60);

  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES
    (t_nueva, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 1200, 14, hoy, hoy + 90);

  SELECT estado, reemplazada_por INTO v_estado, v_reemplazada_por
    FROM public.costeo_tarifas WHERE id = t_vieja;
  PERFORM pg_temp.assert(v_estado = 'reemplazada',
    format('La tarifa anterior quedó en estado "%s", esperaba "reemplazada"', v_estado));
  PERFORM pg_temp.assert(v_reemplazada_por = t_nueva,
    'La tarifa anterior no apunta a la nueva vía reemplazada_por');

  SELECT estado INTO v_estado FROM public.costeo_tarifas WHERE id = t_nueva;
  PERFORM pg_temp.assert(v_estado = 'vigente',
    format('La tarifa nueva quedó en estado "%s", esperaba "vigente"', v_estado));

  -- =========================================================================
  -- TEST 2 · Un BORRADOR (estado_aprobacion <> vigente) NO reemplaza nada.
  -- =========================================================================
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta, estado_aprobacion
  ) VALUES
    (t_borrador, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 900, 14, hoy, hoy + 90, 'borrador');

  SELECT estado INTO v_estado FROM public.costeo_tarifas WHERE id = t_nueva;
  PERFORM pg_temp.assert(v_estado = 'vigente',
    'Una tarifa en borrador reemplazó a la vigente (no debe hacerlo hasta aprobarse)');

  -- =========================================================================
  -- TEST 3 · Estado derivado: vigencia pasada ⇒ "vencida" automáticamente.
  -- =========================================================================
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES
    (t_vencida, org_a, ag_a, naviera_x, ruta_a, tipo_cont, 'USD', 1100, 14, hoy - 90, hoy - 1);

  SELECT estado INTO v_estado FROM public.costeo_tarifas WHERE id = t_vencida;
  PERFORM pg_temp.assert(v_estado = 'vencida',
    format('Tarifa con vigencia pasada quedó en "%s", esperaba "vencida"', v_estado));

  -- La vencida tampoco debe reemplazar a la vigente.
  SELECT estado INTO v_estado FROM public.costeo_tarifas WHERE id = t_nueva;
  PERFORM pg_temp.assert(v_estado = 'vigente',
    'Una tarifa vencida reemplazó a la vigente');

  -- =========================================================================
  -- TEST 4 · Coherencia agente ↔ organización: la org se corrige al dueño
  --          real del agente (no se puede colgar una tarifa de otra org).
  -- =========================================================================
  INSERT INTO public.costeo_tarifas(
    id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta
  ) VALUES
    (t_otra_org, org_a, ag_b, naviera_x, ruta_b, tipo_cont, 'USD', 1000, 14, hoy, hoy + 30);

  SELECT organization_id INTO v_org FROM public.costeo_tarifas WHERE id = t_otra_org;
  PERFORM pg_temp.assert(v_org = org_b,
    'La tarifa conservó una organización distinta a la de su agente');

  -- =========================================================================
  -- TEST 5 · Vista comparable: sólo los recargos `incluido_en_total` suman.
  -- =========================================================================
  INSERT INTO public.costeo_tarifa_recargos(tarifa_id, concepto, lado, monto, moneda, incluido_en_total)
  VALUES (t_nueva, 'THC Origen', 'origen', 200, 'USD', true),
         (t_nueva, 'Inspección opcional', 'destino', 500, 'USD', false);

  SELECT recargos_total, total_comparable INTO v_recargos, v_total
    FROM public.costeo_tarifas_vigentes_v WHERE id = t_nueva;
  PERFORM pg_temp.assert(v_recargos = 200,
    format('recargos_total = %s, esperaba 200 (el recargo excluido no debe sumar)', v_recargos));
  PERFORM pg_temp.assert(v_total = 1400,
    format('total_comparable = %s, esperaba 1400 (flete 1200 + recargo 200)', v_total));

  -- =========================================================================
  -- TEST 6 · La vista sólo expone tarifas realmente ofertables.
  -- =========================================================================
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas_vigentes_v
   WHERE id IN (t_vieja, t_borrador, t_vencida);
  PERFORM pg_temp.assert(visible = 0,
    format('La vista expuso %s tarifas reemplazadas/borrador/vencidas, esperaba 0', visible));

  -- Agente inactivo ⇒ sus tarifas salen del comparador.
  UPDATE public.costeo_agentes SET activo = false WHERE id = ag_a;
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas_vigentes_v WHERE id = t_nueva;
  PERFORM pg_temp.assert(visible = 0,
    'La vista sigue mostrando tarifas de un agente inactivo');
  UPDATE public.costeo_agentes SET activo = true WHERE id = ag_a;

  -- =========================================================================
  -- TEST 7 · Aislamiento multi-tenant de la vista (fuga de precios).
  -- =========================================================================
  PERFORM pg_temp.as_user(user_b);
  SELECT COUNT(*) INTO visible FROM public.costeo_tarifas_vigentes_v WHERE id = t_nueva;
  PERFORM pg_temp.assert(visible = 0,
    'Org B vio una tarifa vigente de Org A a través de costeo_tarifas_vigentes_v');
  PERFORM pg_temp.as_postgres();

  RAISE NOTICE '✓ Regresión de costeo/tarifas OK (7 bloques)';
END $$;

ROLLBACK;
