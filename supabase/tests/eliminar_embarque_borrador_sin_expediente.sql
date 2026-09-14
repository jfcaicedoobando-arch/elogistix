-- =============================================================
-- eliminar_embarque_borrador_sin_expediente.sql · v13.823.387
--
-- `eliminar_embarque_completo` leía el expediente para decidir si el embarque
-- existía (`IF v_expediente IS NULL THEN RAISE 'Embarque no encontrado'`), así
-- que un embarque en Borrador todavía sin expediente asignado NUNCA se podía
-- eliminar desde la UI.
--
--   · CASO 1 (positivo): un Borrador sin expediente se elimina (soft-delete) y
--     la bitácora queda con una etiqueta legible, no vacía.
--   · CASO 2 (negativo): un embarque con factura viva sigue bloqueado con
--     LC_EMBARQUE_BLOQUEADO (el candado fiscal no se relajó).
--
-- Todo el fixture vive dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/eliminar_embarque_borrador_sin_expediente.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_emb uuid;
  v_emb2 uuid;
  v_deleted timestamptz;
  v_nombre text;
  v_fallo boolean := false;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST DEL BORRADOR SIN EXP', 'TDB000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'del-borrador@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'admin_org'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE DEL BORRADOR', '', 'cli-del-borrador@test.mx')
  RETURNING id INTO v_cli;

  -- Borrador SIN expediente (así los crea el wizard antes de asignar folio).
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org, v_cli, NULL, 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Borrador'::public.estado_embarque)
  RETURNING id INTO v_emb;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- ── CASO 1 · el Borrador sin expediente se elimina.
  PERFORM public.eliminar_embarque_completo(v_emb);

  SELECT deleted_at INTO v_deleted FROM public.embarques WHERE id = v_emb;
  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el borrador sin expediente no quedó eliminado';
  END IF;

  SELECT entidad_nombre INTO v_nombre
  FROM public.bitacora_actividad
  WHERE entidad_id = v_emb AND accion = 'eliminar_embarque'
  ORDER BY created_at DESC LIMIT 1;
  IF COALESCE(btrim(v_nombre), '') = '' THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la bitácora quedó sin etiqueta legible del embarque';
  END IF;
  RAISE NOTICE 'CASO 1 OK: borrador sin expediente eliminado (bitácora: %)', v_nombre;

  -- ── CASO 2 · con factura viva sigue bloqueado.
  INSERT INTO public.embarques (organization_id, cliente_id, expediente, modo, tipo, estado)
  VALUES (v_org, v_cli, NULL, 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion, 'Borrador'::public.estado_embarque)
  RETURNING id INTO v_emb2;

  INSERT INTO public.facturas
    (organization_id, cliente_id, embarque_id, numero, estado, moneda, subtotal, iva, total, fecha)
  VALUES
    (v_org, v_cli, v_emb2, 'TDB-0001', 'Emitida'::public.estado_factura, 'MXN'::public.moneda,
     100, 16, 116, CURRENT_DATE);

  BEGIN
    PERFORM public.eliminar_embarque_completo(v_emb2);
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
    IF SQLERRM !~ 'LC_EMBARQUE_BLOQUEADO' THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba LC_EMBARQUE_BLOQUEADO, se obtuvo: %', SQLERRM;
    END IF;
  END;
  IF NOT v_fallo THEN
    RAISE EXCEPTION 'REGRESION P0: se eliminó un embarque con factura viva';
  END IF;
  RAISE NOTICE 'CASO 2 OK: el candado fiscal sigue bloqueando el borrado';
END;
$$;

ROLLBACK;
