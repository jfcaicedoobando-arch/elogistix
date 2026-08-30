CREATE OR REPLACE FUNCTION public.reabrir_embarque(p_embarque_id uuid, p_usuario_email text, p_motivo text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_estado_actual text;
  v_resp jsonb;
  v_es_admin boolean;
  v_motivo text := NULLIF(trim(COALESCE(p_motivo, '')), '');
  v_actor_id uuid := auth.uid();
  v_actor_email text;
BEGIN
  -- B-06: identidad no falsificable. `p_usuario_email` se ignora.
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));

  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id
     AND deleted_at IS NULL;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  v_es_admin := public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'super_admin'::app_role)
             OR public.has_role(auth.uid(), 'admin_org'::app_role);
  IF NOT v_es_admin THEN
    RAISE EXCEPTION 'Solo administradores pueden reabrir embarques cerrados';
  END IF;

  PERFORM public._assert_writer(v_org_id);

  IF v_estado_actual <> 'Cerrado' THEN
    RAISE EXCEPTION 'Solo embarques en estado Cerrado pueden reabrirse (estado actual: %)', v_estado_actual;
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);
  PERFORM set_config('app.bypass_transicion','on', true);

  -- A-1 (Ola 1): `embarques` sólo tiene `cerrado_snapshot`. `pnl_base` y
  -- `calculo_snapshot` viven en `comisiones_devengadas` (ver UPDATE abajo);
  -- escribirlos aquí rompía la reapertura con 42703.
  UPDATE embarques
     SET estado = 'Por liquidar'::estado_embarque,
         cerrado_snapshot = NULL,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  PERFORM set_config('app.bypass_transicion','off', true);

  UPDATE comisiones_devengadas
     SET definitiva = false,
         pnl_base = NULL,
         calculo_snapshot = NULL,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Por liquidar. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), v_actor_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  PERFORM public.registrar_bitacora(
    'embarques', 'reabrir_embarque', p_embarque_id, '',
    jsonb_build_object('motivo', v_motivo), v_org_id, auth.uid()
  );

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Por liquidar');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(p_liquidacion_id uuid, p_motivo text)
 RETURNS public.liquidaciones_comision
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_MOTIVO_REQUERIDO: Captura el motivo de la cancelación.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  -- A-2 (Ola 1): comisiones ORDINARIAS de la liquidación vuelven a devengarse.
  UPDATE public.comisiones_devengadas
     SET estado = 'Devengada', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Liquidada';

  -- A-2 (Ola 1): las RECUPERACIONES que esta liquidación descontó quedaron
  -- marcadas 'Cancelada'. Al cancelar la liquidación la deuda sigue viva:
  -- regresan a 'Por recuperar', no a 'Devengada' (eso las volvía pagables).
  UPDATE public.comisiones_devengadas
     SET estado = 'Por recuperar', liquidacion_id = NULL, updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado = 'Cancelada';

  UPDATE public.liquidaciones_comision
     SET estado = 'Cancelada',
         cancelada_at = now(),
         cancelada_por = v_uid,
         motivo_cancelacion = TRIM(p_motivo),
         updated_at = now()
   WHERE id = p_liquidacion_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_liquidacion_comision', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('motivo', TRIM(p_motivo), 'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_liquidacion_comision: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;