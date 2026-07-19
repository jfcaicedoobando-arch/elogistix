CREATE OR REPLACE FUNCTION public.recotizar_cotizacion(p_cotizacion_id uuid, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old INT;
  v_new INT;
  v_org UUID;
  v_folio TEXT;
  v_embarque_expediente TEXT;
BEGIN
  SELECT version, organization_id, folio INTO v_old, v_org, v_folio
  FROM cotizaciones WHERE id = p_cotizacion_id;

  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE='P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE='42501';
  END IF;

  IF coalesce(trim(p_motivo),'') = '' THEN
    RAISE EXCEPTION 'Motivo requerido' USING ERRCODE='22023';
  END IF;

  -- Bug 15 guard: block re-versioning if there is any active shipment linked
  SELECT expediente INTO v_embarque_expediente
  FROM public.embarques
  WHERE cotizacion_id = p_cotizacion_id
    AND deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_embarque_expediente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COTIZACION_CON_EMBARQUE'
      USING HINT = v_embarque_expediente,
            ERRCODE = 'P0001';
  END IF;

  PERFORM archivar_version_cotizacion(p_cotizacion_id, p_motivo);
  v_new := v_old + 1;

  UPDATE cotizaciones
     SET version = v_new, estado = 'Borrador', updated_at = now()
   WHERE id = p_cotizacion_id;

  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (
    v_org,
    auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'cotizacion.versionada',
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_folio, ''),
    jsonb_build_object('version_anterior', v_old, 'version_nueva', v_new, 'motivo', p_motivo)
  );

  RETURN jsonb_build_object('cotizacion_id', p_cotizacion_id, 'version_anterior', v_old, 'version_nueva', v_new);
END $function$;