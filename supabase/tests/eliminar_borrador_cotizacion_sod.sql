-- =============================================================
-- eliminar_borrador_cotizacion_sod.sql · v13.823.389
--
-- `eliminar_embarque_completo` regresa la cotización a 'Aceptada' cuando ya no
-- queda ningún embarque vivo. El trigger SoD
-- (_cotizaciones_bloquear_auto_aceptacion) interpretaba ese regreso como una
-- auto-aceptación y abortaba el borrado con LC_SOD_VIOLATION (23514) cuando la
-- persona que eliminaba era la misma que creó la cotización.
--
--   · CASO 1 (positivo): el creador de la cotización (rol NO admin) elimina su
--     embarque borrador y la cotización regresa a 'Aceptada'.
--   · CASO 2 (negativo): el SoD real sigue vivo: 'Enviada' -> 'Aceptada' hecho
--     por el creador (rol no admin) sigue fallando con LC_SOD_VIOLATION.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/eliminar_borrador_cotizacion_sod.sql
-- =============================================================

BEGIN;

DO $$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_cli uuid;
  v_cot uuid;
  v_cot2 uuid;
  v_emb uuid;
  v_estado public.estado_cotizacion;
  v_deleted timestamptz;
  v_fallo boolean := false;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
  VALUES ('TEST SOD BORRADOR COT', 'TSB000000XX0', 'basico', true)
  RETURNING id INTO v_org;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'sod-borrador@test.mx')
  ON CONFLICT (id) DO NOTHING;
  -- Rol operador: puede eliminar embarques pero NO está exento del SoD.
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'operador'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, 'operador'::public.app_role) ON CONFLICT DO NOTHING;

  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
  VALUES (v_org, 'CLIENTE SOD BORRADOR', '', 'cli-sod-borrador@test.mx')
  RETURNING id INTO v_cli;

  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda)
  VALUES (v_org, v_cli, 'En operación'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda)
  RETURNING id INTO v_cot;

  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, cotizacion_id)
  VALUES (v_org, v_cli, NULL, 'Marítimo'::public.modo_transporte,
          'Importación'::public.tipo_operacion,
          'Borrador'::public.estado_embarque, v_cot)
  RETURNING id INTO v_emb;

  UPDATE public.cotizaciones SET embarque_id = v_emb WHERE id = v_cot;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  -- ── CASO 1 · el creador de la cotización elimina su borrador.
  PERFORM public.eliminar_embarque_completo(v_emb);

  SELECT deleted_at INTO v_deleted FROM public.embarques WHERE id = v_emb;
  IF v_deleted IS NULL THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: el borrador de la cotización no quedó eliminado';
  END IF;

  SELECT estado INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  IF v_estado <> 'Aceptada'::public.estado_cotizacion THEN
    RAISE EXCEPTION 'CASO 1 FALLÓ: la cotización quedó en % (se esperaba Aceptada)', v_estado;
  END IF;
  RAISE NOTICE 'CASO 1 OK: borrador eliminado y cotización de vuelta en Aceptada';

  -- ── CASO 2 · el SoD real sigue bloqueando la auto-aceptación.
  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, estado, created_by, moneda)
  VALUES (v_org, v_cli, 'Enviada'::public.estado_cotizacion, v_uid,
          'MXN'::public.moneda)
  RETURNING id INTO v_cot2;

  BEGIN
    UPDATE public.cotizaciones
       SET estado = 'Aceptada'::public.estado_cotizacion
     WHERE id = v_cot2;
  EXCEPTION WHEN OTHERS THEN
    v_fallo := true;
    IF SQLERRM !~ 'LC_SOD_VIOLATION' THEN
      RAISE EXCEPTION 'CASO 2 FALLÓ: se esperaba LC_SOD_VIOLATION, se obtuvo: %', SQLERRM;
    END IF;
  END;
  IF NOT v_fallo THEN
    RAISE EXCEPTION 'REGRESION P0: el creador aceptó su propia cotización (SoD relajado)';
  END IF;
  RAISE NOTICE 'CASO 2 OK: el SoD sigue bloqueando la auto-aceptación';
END;
$$;

ROLLBACK;
