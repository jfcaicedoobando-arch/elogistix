-- ============================================================================
-- Suite RLS — Regresión v13.823.351
--   · public.puede_aprobar_tarifa_cotizacion: rol aprobador comercial.
--   · resolver_reaprobacion_tarifa / recotizar_cotizacion: guard de rol y
--     rechazo de la decisión directa `recotizada`.
--   · duplicar_cotizacion: rechaza cotización eliminada y copia los campos
--     funcionales + los enlaces de tarifa de los costos.
--   · revalidar_tarifa_cotizacion: no ve tarifas de otra organización.
--
-- Ejecución:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_reg_reaprobacion_y_duplicar.sql
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a   uuid := gen_random_uuid();
  org_b   uuid := gen_random_uuid();
  cli_a   uuid := gen_random_uuid();
  cot_id  uuid := gen_random_uuid();
  cot_del uuid := gen_random_uuid();
  nueva   uuid;
  usr     uuid;
  rol     text;
  fallo   boolean;
  n       integer;
  rev     jsonb;
  tar_b   uuid := gen_random_uuid();
  ag_b    uuid := gen_random_uuid();
  prov_b  uuid := gen_random_uuid();
  ruta_b  uuid := gen_random_uuid();
  pto_o   uuid := gen_random_uuid();
  pto_d   uuid := gen_random_uuid();
  tcont   uuid := gen_random_uuid();
  nav_b   uuid := gen_random_uuid();
  usr_a   uuid := gen_random_uuid();
  usr_b   uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS Reaprob A'), (org_b, 'RLS Reaprob B');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
    VALUES (cli_a, 'Cli Reaprob', 'XAXX010101000', 'reaprob@example.com', org_a);

  -- TEST 1: rol aprobador. Ventas/administración/pricing sí; operación,
  -- finanzas y lectura no (espejo de APROBAR_TARIFA_COTIZACION en la UI).
  FOR rol IN SELECT unnest(-- 'admin' es legacy y `user_roles` lo bloquea al insertar.
                     ARRAY['super_admin','admin_org','gerente_comercial','vendedor','ejecutivo_pricing']) LOOP
    usr := gen_random_uuid();
    PERFORM pg_temp.seed_auth_user(usr, 'aprob-' || rol || '@example.com');
    -- `has_role` lee `user_roles`; `super_admin` no puede venir de la membresía.
    INSERT INTO public.user_roles(user_id, role) VALUES (usr, rol::app_role);
    PERFORM pg_temp.assert(public.puede_aprobar_tarifa_cotizacion(usr),
      rol || ' debe poder aprobar/re-cotizar');
  END LOOP;

  FOR rol IN SELECT unnest(ARRAY['coordinador_logistico','gerente_operaciones','contador','tesorero','customer_service']) LOOP
    usr := gen_random_uuid();
    PERFORM pg_temp.seed_auth_user(usr, 'noaprob-' || rol || '@example.com');
    INSERT INTO public.user_roles(user_id, role) VALUES (usr, rol::app_role);
    PERFORM pg_temp.assert(NOT public.puede_aprobar_tarifa_cotizacion(usr),
      rol || ' NO debe poder aprobar/re-cotizar');
  END LOOP;

  -- TEST 2: `recotizada` ya no es una decisión directa.
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm,
                                  estado, version, estado_revalidacion, es_prospecto, tipo_carga, tipo_embarque,
                                  num_contenedores, seguro, valor_seguro_usd, carta_garantia, dias_libres_destino,
                                  tipo_cambio_usd, subtotal, moneda, vigencia_dias)
    VALUES (cot_id, org_a, cli_a, 'Cli Reaprob', 'COT-RA-0001', 'Marítimo', 'Importación', 'FOB',
            'Aceptada', 1, 'pendiente_reaprobacion', false, 'FCL', 'FCL',
            3, true, 15000, true, 14, 17.4453, 1000, 'USD', 15);
  fallo := false;
  BEGIN
    PERFORM public.resolver_reaprobacion_tarifa(cot_id, 'recotizada');
  EXCEPTION WHEN OTHERS THEN
    fallo := SQLERRM LIKE '%LC_RECOTIZADA_NO_DIRECTA%';
  END;
  PERFORM pg_temp.assert(fallo, 'resolver debe rechazar la decisión directa recotizada');

  -- TEST 3: duplicar rechaza una cotización eliminada y no inserta filas.
  INSERT INTO public.cotizaciones(id, organization_id, cliente_id, cliente_nombre, folio, modo, tipo, incoterm,
                                  estado, version, deleted_at)
    VALUES (cot_del, org_a, cli_a, 'Cli Reaprob', 'COT-RA-DEL', 'Marítimo', 'Importación', 'FOB',
            'Borrador', 1, now());
  SELECT count(*) INTO n FROM public.cotizaciones WHERE organization_id = org_a;
  fallo := false;
  BEGIN
    PERFORM public.duplicar_cotizacion(cot_del);
  EXCEPTION WHEN OTHERS THEN
    fallo := (SQLERRM LIKE '%LC_COTIZACION_ELIMINADA%') OR (SQLERRM LIKE '%organización%') OR (SQLERRM LIKE '%Rol insuficiente%');
  END;
  PERFORM pg_temp.assert(fallo, 'duplicar debe rechazar una cotización eliminada');
  PERFORM pg_temp.assert(
    (SELECT count(*) FROM public.cotizaciones WHERE organization_id = org_a) = n,
    'duplicar una cotización eliminada no debe insertar filas');

  -- TEST 4: aislamiento cross-org — una tarifa de org_b no es visible para la
  -- revalidación de una cotización de org_a (la FK es sólo por UUID).
  INSERT INTO public.puertos(id, code, name, country) VALUES (pto_o, 'CNRA1', 'Origen RA', 'CN'), (pto_d, 'MXRA1', 'Destino RA', 'MX');
  INSERT INTO public.tipos_contenedor(id, code, name, activo) VALUES (tcont, '40RA', '40 HC RA', true);
  INSERT INTO public.proveedores(id, nombre, rfc, contacto, email, telefono, moneda_preferida, organization_id, tipo, categoria)
    VALUES (prov_b, 'Prov RA B', 'RAB010101BBB', 'C', 'b@b', '555', 'USD', org_b,
            'Agente de Carga'::tipo_proveedor, 'Logistico'::categoria_proveedor);
  INSERT INTO public.costeo_agentes(id, organization_id, proveedor_id, nombre, pais, dias_credito, activo)
    VALUES (ag_b, org_b, prov_b, 'Agente RA B', 'CN', 30, true);
  INSERT INTO public.navieras(id, code, name, activo) VALUES (nav_b, 'RAB1', 'Naviera RA B', true);
  INSERT INTO public.costeo_rutas(id, organization_id, puerto_origen_id, puerto_destino_id, activa)
    VALUES (ruta_b, org_b, pto_o, pto_d, true);
  INSERT INTO public.costeo_tarifas(id, organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id,
                                    moneda, flete_base, dias_libres_demoras, vigente_desde, vigente_hasta)
    VALUES (tar_b, org_b, ag_b, nav_b, ruta_b, tcont, 'USD', 1500, 14, current_date - 5, current_date + 60);
  UPDATE public.cotizaciones SET tarifa_id = tar_b WHERE id = cot_id;
  INSERT INTO public.cotizacion_costos(cotizacion_id, organization_id, concepto, moneda, cantidad,
                                       costo_unitario, precio_venta, costeo_tarifa_id)
    VALUES (cot_id, org_a, 'Flete', 'USD', 1, 1500, 1800, tar_b);
  -- La revalidación exige un miembro autenticado de la organización de la cotización.
  PERFORM pg_temp.seed_auth_user(usr_a, 'miembro-ra@example.com');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_a, usr_a, 'admin_org');
  PERFORM pg_temp.as_user(usr_a);
  rev := public.revalidar_tarifa_cotizacion(cot_id);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert((rev->>'tarifa_vigente')::boolean IS NOT TRUE,
    'una tarifa de otra organización no debe considerarse vigente');
  PERFORM pg_temp.assert(
    (rev->'cambios')::text LIKE '%eliminado%',
    'el costo ligado a una tarifa de otra organización debe reportarse como no encontrado');

  -- TEST 5: duplicar copia los campos funcionales y los enlaces de tarifa.
  -- `admin_org` ya quedó sincronizado en `user_roles` desde la membresía.
  PERFORM pg_temp.as_user(usr_a);
  nueva := public.duplicar_cotizacion(cot_id);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM public.cotizaciones n JOIN public.cotizaciones o ON o.id = cot_id
    WHERE n.id = nueva
      AND n.estado = 'Borrador' AND n.version = 1 AND n.estado_revalidacion = 'ninguna'
      AND n.duplicada_de_id = cot_id AND n.embarque_id IS NULL
      AND n.organization_id = o.organization_id AND n.cliente_id = o.cliente_id
      AND n.tipo_carga = o.tipo_carga AND n.tipo_embarque = o.tipo_embarque
      AND n.num_contenedores = o.num_contenedores AND n.seguro = o.seguro
      AND n.valor_seguro_usd = o.valor_seguro_usd AND n.carta_garantia = o.carta_garantia
      AND n.dias_libres_destino = o.dias_libres_destino AND n.tipo_cambio_usd = o.tipo_cambio_usd
      AND n.tarifa_id = o.tarifa_id AND n.moneda = o.moneda AND n.incoterm = o.incoterm
  ), 'duplicar debe copiar los campos funcionales y resetear estado/versión');
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM public.cotizacion_costos WHERE cotizacion_id = nueva AND costeo_tarifa_id = tar_b
  ), 'duplicar debe conservar el enlace de tarifa de cada costo');

  -- TEST 6 (v13.823.352, linter ORG-SCOPE): ancla tenant de
  -- `puede_aprobar_tarifa_cotizacion`. Un vendedor que sólo es miembro de
  -- otra organización no queda autorizado en el contexto de org_a, y el
  -- cuerpo de la función debe referenciar `organization_members` (misma
  -- regla que test_rls_rpc_org_scope_linter.sql).
  PERFORM pg_temp.seed_auth_user(usr_b, 'vendedor-orgb@example.com');
  INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (org_b, usr_b, 'vendedor');
  PERFORM pg_temp.as_user(usr_a);
  PERFORM pg_temp.assert(NOT public.puede_aprobar_tarifa_cotizacion(usr_b),
    'un vendedor de otra organización no debe quedar autorizado en la org activa');
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'puede_aprobar_tarifa_cotizacion'
       AND p.prosrc ~* '(organization_id|organization_members|current_user_org_id)'
  ), 'puede_aprobar_tarifa_cotizacion debe conservar el ancla tenant en su cuerpo');

  RAISE NOTICE 'OK · v13.823.351: rol aprobador, decisión recotizada, duplicar eliminada y aislamiento de tarifas; ancla tenant del rol aprobador';
END $$;

ROLLBACK;
