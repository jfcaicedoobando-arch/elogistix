CREATE OR REPLACE FUNCTION public.aceptar_cotizacion_version(p_cotizacion_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_version INT; v_org UUID; v_folio TEXT;
  v_estado_actual TEXT; v_vigencia DATE;
BEGIN
  SELECT version, organization_id, folio, estado::text, fecha_vigencia
    INTO v_version, v_org, v_folio, v_estado_actual, v_vigencia
    FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_version IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002'; END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_org AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;
  IF v_vigencia IS NOT NULL AND v_vigencia < CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_COT_VENCIDA: la cotización venció el %, extienda la vigencia antes de aceptar', v_vigencia USING ERRCODE='P0001';
  END IF;
  IF v_estado_actual NOT IN ('Borrador','Enviada') THEN
    RAISE EXCEPTION 'LC_COTIZACION_ESTADO_INVALIDO: sólo se puede aceptar en Borrador/Enviada (actual: %, estados_permitidos: [Borrador, Enviada])', v_estado_actual
      USING ERRCODE='P0001', HINT='estados_permitidos=Borrador,Enviada';
  END IF;
  UPDATE cotizaciones
     SET version_aceptada=v_version, aceptada_en=now(), aceptada_por=auth.uid(),
         estado='Aceptada', updated_at=now()
   WHERE id = p_cotizacion_id;
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_org, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id=auth.uid()),''),
    'cotizacion.aceptada_version_fijada','cotizaciones',
    p_cotizacion_id, COALESCE(v_folio,''),
    jsonb_build_object('version_aceptada',v_version,'estado_previo',v_estado_actual));
  RETURN jsonb_build_object('cotizacion_id',p_cotizacion_id,'version_aceptada',v_version);
END;
$function$;