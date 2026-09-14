-- =============================================================
-- borrador_con_factura_viva.sql · v13.823.388
--
-- `avanzar_estado_embarque` permitía regresar un embarque de 'Confirmado' a
-- 'Borrador' aunque ya tuviera factura de cliente viva (caso real ELIMP00310:
-- expediente asignado, factura F1004 viva y estado 'Borrador').
--
--   · CASO 1 (negativo): Confirmado con factura viva → LC_BORRADOR_CON_CXC.
--   · CASO 2 (positivo): Confirmado sin documentos → regresa a Borrador.
--   · CASO 3 (positivo): con la factura cancelada, el regreso vuelve a permitirse.
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/borrador_con_factura_viva.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_emb2 uuid;
  v_fac uuid;
  v_estado public.estado_embarque;
  v_fallo boolean := false;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST BORRADOR CON CXC', 'TBC000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'borrador-cxc@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE BORRADOR CXC', '', 'cli-borrador-cxc@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org, v_cli, 'TBCIMP00001', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Confirmado'::public.estado_embarque)
  RETURNING id INTO v_emb;

  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, embarque_id, numero,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado)
  VALUES
    (v_org, v_cli, 'CLIENTE BORRADOR CXC', v_emb, 'TBC-0001',
     CURRENT_DATE, CURRENT_DATE + 30, 'MXN'::public.moneda, 1, 100, 16, 116, 'Emitida')
  RETURNING id INTO v_fac;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- ── CASO 1 · factura viva bloquea el regreso a Borrador.
  BEGIN
    PERFORM public.avanzar_estado_embarque(
      v_emb, 'Borrador', 'borrador-cxc@test.mx', 'otro', 'regreso a borrador');
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
    IF SQLERRM !~ 'LC_BORRADOR_CON_CXC' THEN
      RAISE EXCEPTION 'CASO 1 FALLÓ: se esperaba LC_BORRADOR_CON_CXC, se obtuvo: %', SQLERRM;
    END IF;
  END;
  IF NOT v_fallo THEN
    RAISE EXCEPTION 'REGRESION P0: un embarque con factura viva regresó a Borrador';
  END IF;
  RAISE NOTICE 'CASO 1 OK: LC_BORRADOR_CON_CXC bloquea el regreso';

  -- ── CASO 2 · sin documentos el regreso funciona igual que antes.
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org, v_cli, 'TBCIMP00002', 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Confirmado'::public.estado_embarque)
  RETURNING id INTO v_emb2;

  PERFORM public.avanzar_estado_embarque(
    v_emb2, 'Borrador', 'borrador-cxc@test.mx', 'otro', 'regreso a borrador');
  SELECT estado INTO v_estado FROM public.embarques WHERE id = v_emb2;
  IF v_estado <> 'Borrador'::public.estado_embarque THEN
    RAISE EXCEPTION 'CASO 2 FALLÓ: el embarque sin documentos no regresó a Borrador (quedó %)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 2 OK: sin documentos el regreso a Borrador sigue permitido';

  -- ── CASO 3 · con la factura cancelada el regreso vuelve a permitirse.
  UPDATE public.facturas SET estado = 'Cancelada' WHERE id = v_fac;

  PERFORM public.avanzar_estado_embarque(
    v_emb, 'Borrador', 'borrador-cxc@test.mx', 'otro', 'regreso a borrador');
  SELECT estado INTO v_estado FROM public.embarques WHERE id = v_emb;
  IF v_estado <> 'Borrador'::public.estado_embarque THEN
    RAISE EXCEPTION 'CASO 3 FALLÓ: con la factura cancelada el embarque no regresó a Borrador (quedó %)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 3 OK: factura cancelada libera el regreso a Borrador';
END;
$$;

ROLLBACK;
