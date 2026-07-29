-- 1) Renombrar la variante legacy (p_embarque_id, p_motivo) para eliminar la
--    sobrecarga ambigua de `reabrir_embarque` en la API.
DROP FUNCTION IF EXISTS public.reabrir_embarque(uuid, text);

CREATE OR REPLACE FUNCTION public.reabrir_embarque_con_motivo(p_embarque_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emb embarques%ROWTYPE;
  v_uid uuid := auth.uid();
  v_admin_puede boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT COALESCE((valor)::text::boolean, false) INTO v_admin_puede
  FROM configuracion_global
  WHERE categoria='cierre' AND clave='cierre_admin_puede_reabrir';

  IF NOT (has_role(v_uid,'super_admin') OR (v_admin_puede AND has_role(v_uid,'admin'))) THEN
    RAISE EXCEPTION 'No autorizado para reabrir embarques';
  END IF;

  SELECT * INTO v_emb FROM embarques WHERE id = p_embarque_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado';
  END IF;

  IF v_emb.estado::text <> 'Cerrado' THEN
    RAISE EXCEPTION 'El embarque no está cerrado';
  END IF;

  PERFORM set_config('app.bypass_cierre','on', true);

  UPDATE embarques
     SET estado = 'Entregado'::estado_embarque,
         reabierto_at = now(),
         reabierto_por = v_uid,
         reabierto_motivo = p_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  UPDATE comisiones_devengadas
     SET definitiva = false,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
  VALUES (p_embarque_id, v_emb.organization_id, 'reabrir', v_uid, p_motivo,
          jsonb_build_object('snapshot_previo', v_emb.cerrado_snapshot));

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (v_emb.organization_id, v_uid, 'reabrir_embarque', 'embarques', p_embarque_id,
            jsonb_build_object('motivo', p_motivo));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_embarque_con_motivo(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque_con_motivo(uuid, text) TO authenticated;

-- 2) Firma única de `reabrir_embarque`, ahora con motivo obligatorio.
DROP FUNCTION IF EXISTS public.reabrir_embarque(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.reabrir_embarque(
  p_embarque_id uuid,
  p_usuario_email text,
  p_motivo text,
  p_request_id uuid DEFAULT NULL::uuid
)
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
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'reabrir_embarque');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  IF v_motivo IS NULL OR length(v_motivo) < 20 THEN
    RAISE EXCEPTION 'Motivo de reapertura requerido (mínimo 20 caracteres)';
  END IF;

  SELECT organization_id, estado::text
    INTO v_org_id, v_estado_actual
    FROM embarques
   WHERE id = p_embarque_id;
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

  UPDATE embarques
     SET estado = 'Entregado'::estado_embarque,
         reabierto_at = now(),
         reabierto_por = auth.uid(),
         reabierto_motivo = v_motivo,
         updated_at = now()
   WHERE id = p_embarque_id;

  UPDATE comisiones_devengadas
     SET definitiva = false,
         updated_at = now()
   WHERE embarque_id = p_embarque_id;

  PERFORM set_config('app.bypass_cierre','off', true);

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Embarque reabierto desde Cerrado a Entregado. Motivo: ' || v_motivo,
          'cambio_estado'::tipo_nota, p_usuario_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, 'Otro'::tipo_evento_tracking, 'Embarque reabierto por administrador', '', now(), p_usuario_email, v_org_id);

  BEGIN
    INSERT INTO cierre_embarque_log(embarque_id, organization_id, accion, usuario_id, motivo, snapshot)
    VALUES (p_embarque_id, v_org_id, 'reabrir', auth.uid(), v_motivo, NULL);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    INSERT INTO bitacora_actividad(organization_id, usuario_id, accion, entidad, entidad_id, detalle)
    VALUES (v_org_id, auth.uid(), 'reabrir_embarque', 'embarques', p_embarque_id,
            jsonb_build_object('motivo', v_motivo));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Entregado');
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_embarque(uuid, text, text, uuid) TO authenticated;
