CREATE OR REPLACE FUNCTION public.registrar_evento_tracking_embarque(
  p_embarque_id uuid, p_request_id uuid, p_accion text, p_fecha date,
  p_ubicacion text, p_organization_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_embarque public.embarques%ROWTYPE;
  v_tipo public.tipo_evento_tracking;
  v_ubicacion text := btrim(coalesce(p_ubicacion, ''));
  v_momento timestamptz := statement_timestamp();
  v_descripcion text;
  v_accion text;
  v_detalles jsonb;
  v_intento jsonb;
  v_anterior jsonb;
  v_pendientes integer;
  v_avanza boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Se requiere una sesión para registrar tracking.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL OR p_fecha IS NULL OR NOT isfinite(p_fecha)
     OR p_accion IS NULL OR p_accion NOT IN ('eta', 'llegada')
     OR char_length(v_ubicacion) > 120 THEN
    RAISE EXCEPTION 'Datos de tracking inválidos.' USING ERRCODE = '22023';
  END IF;

  -- RLS de embarques y eventos sigue aplicando al usuario de la llamada.
  SELECT e.* INTO v_embarque
    FROM public.embarques e
   WHERE e.id = p_embarque_id AND e.deleted_at IS NULL
     AND (p_organization_id IS NULL OR e.organization_id = p_organization_id)
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el embarque o no tienes permiso para editarlo.' USING ERRCODE = '42501';
  END IF;

  v_intento := jsonb_build_object('embarqueId', p_embarque_id,
    'organizationId', v_embarque.organization_id, 'accion', p_accion,
    'fecha', p_fecha, 'ubicacion', v_ubicacion);
  v_anterior := public.idempotency_claim(p_request_id, 'registrar_evento_tracking_embarque');
  IF v_anterior IS NOT NULL THEN
    IF v_anterior->'intento' IS DISTINCT FROM v_intento THEN
      RAISE EXCEPTION 'La clave de tracking ya se usó con otros datos.' USING ERRCODE = '22023';
    END IF;
    RETURN p_request_id;
  END IF;

  IF v_embarque.estado = 'Cerrado' THEN
    RAISE EXCEPTION 'El embarque está cerrado. Reábrelo para registrar tracking.' USING ERRCODE = '23514';
  END IF;

  IF p_accion = 'eta' THEN
    IF char_length(v_ubicacion) < 3 OR p_fecha IS NOT DISTINCT FROM v_embarque.eta THEN
      RAISE EXCEPTION 'Indica la fuente y una ETA distinta a la actual.' USING ERRCODE = '23514';
    END IF;
    UPDATE public.embarques SET eta = p_fecha WHERE id = p_embarque_id;
    v_tipo := 'Cambio de ETA';
    v_descripcion := format('ETA actualizada de %s a %s',
      coalesce(to_char(v_embarque.eta, 'DD/MM/YYYY'), '—'), to_char(p_fecha, 'DD/MM/YYYY'));
    v_accion := 'Actualizó ETA de embarque';
    v_detalles := jsonb_build_object('etaNueva', p_fecha);
  ELSE
    IF v_embarque.fecha_llegada_real IS NOT NULL THEN
      RAISE EXCEPTION 'Este embarque ya tiene una fecha de llegada real capturada.' USING ERRCODE = '23514';
    END IF;
    IF v_embarque.estado NOT IN ('En Tránsito', 'En Proceso', 'Arribo', 'En Aduana', 'Entregado', 'EIR', 'Por liquidar') THEN
      RAISE EXCEPTION 'No se puede marcar llegada real en estado "%". Confirma y pon en tránsito el embarque primero.',
        v_embarque.estado USING ERRCODE = '23514';
    END IF;
    IF p_fecha < v_embarque.etd OR p_fecha > (v_momento AT TIME ZONE 'America/Mexico_City')::date THEN
      RAISE EXCEPTION 'La llegada real debe ser igual o posterior al ETD y no puede ser futura.' USING ERRCODE = '23514';
    END IF;

    -- Bloquea cambios de estado documental durante la validación. El FK de
    -- documentos bloquea altas concurrentes contra la fila del embarque.
    PERFORM d.id FROM public.documentos_embarque d
     WHERE d.embarque_id = p_embarque_id AND d.organization_id = v_embarque.organization_id
       AND d.deleted_at IS NULL
     FOR SHARE;
    SELECT count(*) INTO v_pendientes FROM public.documentos_embarque d
     WHERE d.embarque_id = p_embarque_id AND d.organization_id = v_embarque.organization_id
       AND d.deleted_at IS NULL AND d.estado = 'Pendiente';
    IF v_pendientes > 0 THEN
      RAISE EXCEPTION 'LC_TRACKING_DOCS_PENDIENTES: Hay % documento(s) pendiente(s). Súbelos antes de marcar la llegada real.',
        v_pendientes USING ERRCODE = '23514';
    END IF;

    v_avanza := v_embarque.estado IN ('En Tránsito', 'En Proceso');
    UPDATE public.embarques
       SET fecha_llegada_real = p_fecha,
           estado = CASE WHEN v_avanza THEN 'Arribo' ELSE v_embarque.estado END
     WHERE id = p_embarque_id;
    v_tipo := 'Arribo a Puerto';
    v_descripcion := format('Llegada real registrada: %s', to_char(p_fecha, 'DD/MM/YYYY'));
    v_accion := 'Actualizó fecha de llegada real de embarque';
    v_detalles := jsonb_build_object('fechaLlegadaReal', p_fecha,
      'estadoAnterior', v_embarque.estado, 'avanzoAArribo', v_avanza);
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se pudo editar el embarque.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.eventos_embarque (id, embarque_id, organization_id, tipo, descripcion, ubicacion, fecha, usuario)
    VALUES (p_request_id, p_embarque_id, v_embarque.organization_id, v_tipo,
      v_descripcion, v_ubicacion, v_momento, coalesce(auth.jwt()->>'email', ''));

  PERFORM public.registrar_bitacora('embarques', v_accion, p_embarque_id,
    p_detalles => v_detalles || jsonb_build_object('eventoId', p_request_id),
    p_organization_id => v_embarque.organization_id);
  PERFORM public.registrar_bitacora('embarques', 'Registró evento de tracking en embarque', p_embarque_id,
    p_detalles => jsonb_build_object('eventoId', p_request_id, 'tipo', v_tipo, 'ubicacion', v_ubicacion, 'fecha', v_momento),
    p_organization_id => v_embarque.organization_id);
  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('intento', v_intento));
  RETURN p_request_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_evento_tracking_embarque(uuid, uuid, text, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evento_tracking_embarque(uuid, uuid, text, date, text, uuid) TO authenticated;
