CREATE OR REPLACE FUNCTION public.eliminar_embarque_completo(p_embarque_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_uemail text;
  v_now timestamptz := now();
  v_id uuid;
  v_expediente text;
  v_label text;
  v_org uuid;
  v_org_mutex uuid;
  v_cotizacion_id uuid;
  v_estado text;
  v_cerrado_at timestamptz;
  v_remaining integer;
  v_motivos jsonb;
BEGIN
  -- Authorize before looking at lock state. Preserve existing legacy-role and
  -- global Super Admin authority, rejecting a nullable guard explicitly.
  v_org_mutex := public._h14_assert_actor_baja_embarque(p_embarque_id);
  PERFORM public._h14_mutex_baja_embarque(v_org_mutex, true);
  SELECT id, expediente, organization_id, cotizacion_id, estado::text, cerrado_at
    INTO v_id, v_expediente, v_org, v_cotizacion_id, v_estado, v_cerrado_at
    FROM public.embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  IF v_org IS DISTINCT FROM v_org_mutex THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: el embarque cambió de organización; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END IF;
  -- A waiter must recheck roles and use a new RC snapshot after acquiring locks.
  PERFORM public._h14_assert_actor_baja_embarque(p_embarque_id);
  v_motivos := public._h14_dependencias_baja_embarque(p_embarque_id, v_org,
    v_org = public.current_user_org_id());
  IF v_motivos IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: sin acceso al embarque' USING ERRCODE = '42501';
  END IF;
  v_label := v_motivos->>'expediente';
  IF (v_motivos->>'bloqueado')::boolean IS TRUE THEN
    RAISE EXCEPTION 'LC_EMBARQUE_BLOQUEADO: el embarque % tiene dependencias fiscales o está cerrado', v_label
      USING HINT = v_motivos::text, ERRCODE = '23514';
  END IF;

  UPDATE public.conceptos_venta        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.conceptos_costo        SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.documentos_embarque    SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.notas_embarque         SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.eventos_embarque       SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.embarque_contenedores  SET deleted_at = v_now, deleted_by = v_uid WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;
  UPDATE public.seguros_embarque       SET deleted_at = v_now                    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL;

  UPDATE public.embarques
     SET deleted_at = v_now, deleted_by = v_uid
   WHERE id = p_embarque_id AND deleted_at IS NULL;

  IF v_cotizacion_id IS NOT NULL THEN
    SELECT count(*) INTO v_remaining
    FROM public.embarques
    WHERE cotizacion_id = v_cotizacion_id AND deleted_at IS NULL;

    IF v_remaining = 0 THEN
      UPDATE public.cotizaciones
         SET estado = 'Aceptada',
             embarque_id = NULL,
             updated_at = now()
       WHERE id = v_cotizacion_id
         AND (estado <> 'Aceptada' OR embarque_id IS NOT NULL);

      UPDATE public.embarques
         SET cotizacion_id = NULL
       WHERE id = p_embarque_id
         AND cotizacion_id IS NOT NULL;
    END IF;
  END IF;

  BEGIN
    SELECT email INTO v_uemail FROM auth.users WHERE id = v_uid;
  EXCEPTION WHEN OTHERS THEN v_uemail := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, organization_id)
    VALUES
      (v_uid, v_uemail, 'eliminar_embarque', 'embarques', p_embarque_id, v_label,
       jsonb_build_object(
         'cotizacion_revertida', (v_cotizacion_id IS NOT NULL AND v_remaining = 0),
         'estado_previo', v_estado
       ),
       v_org);
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.eliminar_embarque_completo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_embarque_completo(uuid) TO authenticated, service_role, postgres;
