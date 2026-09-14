-- =============================================================
-- tarifa_sustituida_ruta_y_delta.sql · v13.823.392
--
-- Auditoría cotización → embarque, puntos #3 y #4:
--   · CASO 1: sustituir por una tarifa de OTRA ruta ⇒ LC_TARIFA_RUTA_INCOMPATIBLE.
--   · CASO 2: sustituir por una tarifa de OTRO tipo de contenedor ⇒
--     LC_TARIFA_TIPO_INCOMPATIBLE.
--   · CASO 3: el delta de una sustitución se calcula EN SERVIDOR contra la
--     tarifa elegida; un delta manipulado del navegador no puede fabricarlo.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/tarifa_sustituida_ruta_y_delta.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org    uuid;
  v_uid    uuid := gen_random_uuid();
  v_prov   uuid;
  v_ag     uuid;
  v_nav1   uuid;
  v_nav2   uuid;
  v_po     uuid;
  v_pd     uuid;
  v_pd2    uuid;
  v_ruta1  uuid;
  v_ruta2  uuid;
  v_tc20   uuid;
  v_tc40   uuid;
  v_t_base uuid;
  v_t_ruta uuid;
  v_t_tipo uuid;
  v_t_ok   uuid;
  v_cli    uuid;
  v_cot    uuid;
  v_emb    uuid;
  v_delta  jsonb;
  v_ok     boolean;
  v_msg    text;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST TARIFA SUST', 'TTS000000XX0', 'basico', true) RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'coord-tarifa@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.proveedores (organization_id, nombre, rfc, categoria, tipo)
  VALUES (v_org, 'AGENTE TARIFA SUST', 'XAXX010101000', 'Logistico', 'Transportista')
  RETURNING id INTO v_prov;
  INSERT INTO public.costeo_agentes (organization_id, proveedor_id, nombre)
  VALUES (v_org, v_prov, 'AGENTE TARIFA SUST') RETURNING id INTO v_ag;

  INSERT INTO public.navieras (code, name) VALUES ('TSTN1', 'Naviera Uno')
  RETURNING id INTO v_nav1;
  INSERT INTO public.navieras (code, name) VALUES ('TSTN2', 'Naviera Dos')
  RETURNING id INTO v_nav2;

  INSERT INTO public.puertos (code, name, country) VALUES ('TSTPO', 'Puerto Origen', 'CN')
  RETURNING id INTO v_po;
  INSERT INTO public.puertos (code, name, country) VALUES ('TSTPD', 'Puerto Destino', 'MX')
  RETURNING id INTO v_pd;
  INSERT INTO public.puertos (code, name, country) VALUES ('TSTPD2', 'Otro Destino', 'MX')
  RETURNING id INTO v_pd2;

  INSERT INTO public.costeo_rutas (organization_id, puerto_origen_id, puerto_destino_id)
  VALUES (v_org, v_po, v_pd) RETURNING id INTO v_ruta1;
  INSERT INTO public.costeo_rutas (organization_id, puerto_origen_id, puerto_destino_id)
  VALUES (v_org, v_po, v_pd2) RETURNING id INTO v_ruta2;

  INSERT INTO public.tipos_contenedor (code, name) VALUES ('TST20', '20 pies TEST')
  RETURNING id INTO v_tc20;
  INSERT INTO public.tipos_contenedor (code, name) VALUES ('TST40', '40 pies TEST')
  RETURNING id INTO v_tc40;

  -- Tarifa original de la cotización.
  INSERT INTO public.costeo_tarifas
    (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, moneda,
     flete_base, vigente_desde, vigente_hasta)
  VALUES (v_org, v_ag, v_nav1, v_ruta1, v_tc20, 'USD', 1000,
          CURRENT_DATE - 1, CURRENT_DATE + 30) RETURNING id INTO v_t_base;

  -- Sustituta de OTRA ruta (mismo agente y moneda).
  INSERT INTO public.costeo_tarifas
    (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, moneda,
     flete_base, vigente_desde, vigente_hasta)
  VALUES (v_org, v_ag, v_nav2, v_ruta2, v_tc20, 'USD', 900,
          CURRENT_DATE - 1, CURRENT_DATE + 30) RETURNING id INTO v_t_ruta;

  -- Sustituta de OTRO tipo de contenedor (misma ruta).
  INSERT INTO public.costeo_tarifas
    (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, moneda,
     flete_base, vigente_desde, vigente_hasta)
  VALUES (v_org, v_ag, v_nav2, v_ruta1, v_tc40, 'USD', 950,
          CURRENT_DATE - 1, CURRENT_DATE + 30) RETURNING id INTO v_t_tipo;

  -- Sustituta VÁLIDA: misma ruta y tipo, otra naviera y otro flete.
  INSERT INTO public.costeo_tarifas
    (organization_id, agente_id, naviera_id, ruta_id, tipo_contenedor_id, moneda,
     flete_base, vigente_desde, vigente_hasta)
  VALUES (v_org, v_ag, v_nav2, v_ruta1, v_tc20, 'USD', 1200,
          CURRENT_DATE, CURRENT_DATE + 30) RETURNING id INTO v_t_ok;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE TARIFA SUST', '', 'cli-tarifa-sust@test.mx') RETURNING id INTO v_cli;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo, tarifa_id)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, v_uid,
          'USD'::public.moneda, 'COT-TSUST-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion, v_t_base)
  RETURNING id INTO v_cot;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario,
     precio_venta, costeo_tarifa_id)
  VALUES (v_cot, v_org, 'Flete marítimo', 'USD', 1, 1000, 0, v_t_base);

  INSERT INTO public.embarques
    (organization_id, cliente_id, cotizacion_id, estado, modo, tipo, tarifa_id, naviera_id, naviera)
  VALUES (v_org, v_cli, v_cot, 'Borrador'::public.estado_embarque,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
          v_t_base, v_nav1, 'Naviera Uno')
  RETURNING id INTO v_emb;

  -- ---------------- CASO 1: otra ruta ---------------------------------------
  v_ok := false;
  BEGIN
    PERFORM public._embarque_aplicar_tarifa_decidida(v_emb, v_cot, v_t_ruta);
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
    v_ok := v_msg LIKE '%LC_TARIFA_RUTA_INCOMPATIBLE%';
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaba LC_TARIFA_RUTA_INCOMPATIBLE, se obtuvo: %', COALESCE(v_msg, 'sin error');
  END IF;
  RAISE NOTICE 'CASO 1 OK: la sustituta de otra ruta se rechaza';

  -- ---------------- CASO 2: otro tipo de contenedor -------------------------
  v_ok := false;
  BEGIN
    PERFORM public._embarque_aplicar_tarifa_decidida(v_emb, v_cot, v_t_tipo);
  EXCEPTION WHEN others THEN
    v_msg := SQLERRM;
    v_ok := v_msg LIKE '%LC_TARIFA_TIPO_INCOMPATIBLE%';
  END;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba LC_TARIFA_TIPO_INCOMPATIBLE, se obtuvo: %', COALESCE(v_msg, 'sin error');
  END IF;
  RAISE NOTICE 'CASO 2 OK: la sustituta de otro tipo de contenedor se rechaza';

  -- ---------------- CASO 3: delta calculado en servidor ---------------------
  v_delta := public._embarque_delta_tarifa_sustituida(v_cot, v_t_ok);
  IF v_delta->>'origen' <> 'servidor' THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el delta no viene marcado como calculado en servidor: %', v_delta;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_delta->'cambios') c
     WHERE c->>'concepto' = 'Flete base'
       AND (c->>'monto_anterior')::numeric = 1000
       AND (c->>'monto_actual')::numeric = 1200
  ) THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: el delta no refleja el flete real de la tarifa elegida: %', v_delta;
  END IF;
  RAISE NOTICE 'CASO 3 OK: el delta de la sustitución se calcula contra la tarifa elegida';
END;
$$;

ROLLBACK;
