-- =============================================================
-- costos_cotizacion_coordinador_logistico.sql · v13.823.391
--
-- Un Coordinador Logístico no estaba en `puede_ver_costos_cotizacion`, así que
-- la política `Tenant read cotizacion_costos` le filtraba TODAS las filas sin
-- error: el candado de UI (`tieneCostosCargados`) contaba 0 y avisaba "la
-- cotización no tiene costos cargados" al crear el embarque (falso negativo).
--
--   · CASO 1 (positivo): coordinador_logistico ve los costos de una cotización
--     de su organización vía RLS.
--   · CASO 2 (negativo): el candado de organización sigue vivo — no ve los
--     costos de una cotización de OTRA organización.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/costos_cotizacion_coordinador_logistico.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org   uuid;
  v_org2  uuid;
  v_uid   uuid := gen_random_uuid();
  v_cli   uuid;
  v_cli2  uuid;
  v_cot   uuid;
  v_cot2  uuid;
  v_visto integer;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST COSTOS COORD', 'TCC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST COSTOS COORD AJENA', 'TCC000000XX1', 'basico', true)
  RETURNING id INTO v_org2;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'coord-costos@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'coordinador_logistico'::public.app_role) ON CONFLICT DO NOTHING;

  IF NOT public.puede_ver_costos_cotizacion(v_uid) THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: coordinador_logistico no puede ver costos de cotización';
  END IF;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE COORD COSTOS', '', 'cli-coord-costos@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org2, 'CLIENTE AJENO COSTOS', '', 'cli-ajeno-costos@test.mx')
  RETURNING id INTO v_cli2;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo)
  VALUES (v_org, v_cli, 'Aceptada'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda, 'COT-COORD-0001',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_cot;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda, folio, modo, tipo)
  VALUES (v_org2, v_cli2, 'Aceptada'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda, 'COT-COORD-0002',
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  RETURNING id INTO v_cot2;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_cot, v_org, 'Flete marítimo', 'USD', 1, 1000, 1300);

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, organization_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_cot2, v_org2, 'Flete marítimo ajeno', 'USD', 1, 900, 1200);

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  SET LOCAL ROLE authenticated;

  SELECT count(*) INTO v_visto
    FROM public.cotizacion_costos
   WHERE cotizacion_id = v_cot AND deleted_at IS NULL;
  IF v_visto <> 1 THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: RLS mostró % filas de costos (se esperaba 1)', v_visto;
  END IF;
  RAISE NOTICE 'CASO 1 OK: el coordinador logístico ve los costos de su cotización';

  SELECT count(*) INTO v_visto
    FROM public.cotizacion_costos
   WHERE cotizacion_id = v_cot2;
  IF v_visto <> 0 THEN
    RAISE EXCEPTION 'REGRESION P0: vio % filas de costos de otra organización', v_visto;
  END IF;
  RAISE NOTICE 'CASO 2 OK: los costos de otra organización siguen ocultos';

  RESET ROLE;
END;
$$;

ROLLBACK;
