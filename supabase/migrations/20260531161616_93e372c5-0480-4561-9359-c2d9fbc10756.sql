-- Fase 1: Trazabilidad de aceptación/rechazo de cotizaciones

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS fecha_aceptacion timestamptz NULL,
  ADD COLUMN IF NOT EXISTS fecha_rechazo timestamptz NULL;

CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(
  p_cotizacion_id uuid,
  p_respuesta text,
  p_comentario text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cotizacion cotizaciones%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_comentario text;
BEGIN
  IF p_respuesta NOT IN ('Aceptada', 'Rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida. Debe ser "Aceptada" o "Rechazada".';
  END IF;

  SELECT * INTO v_cotizacion
  FROM cotizaciones
  WHERE id = p_cotizacion_id
    AND cliente_id IN (SELECT current_user_client_ids());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cotización no encontrada o no tienes acceso.';
  END IF;

  IF v_cotizacion.estado != 'Enviada' THEN
    RAISE EXCEPTION 'Solo se pueden responder cotizaciones en estado "Enviada". Estado actual: %', v_cotizacion.estado;
  END IF;

  v_comentario := NULLIF(trim(p_comentario), '');

  UPDATE cotizaciones
  SET estado = p_respuesta::estado_cotizacion,
      comentario_cliente = v_comentario,
      fecha_aceptacion = CASE WHEN p_respuesta = 'Aceptada' THEN v_now ELSE fecha_aceptacion END,
      fecha_rechazo    = CASE WHEN p_respuesta = 'Rechazada' THEN v_now ELSE fecha_rechazo END,
      updated_at = v_now
  WHERE id = p_cotizacion_id;

  -- Email del usuario actual (cliente desde portal)
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- Registrar en bitácora de la organización dueña de la cotización
  INSERT INTO public.bitacora_actividad (
    organization_id,
    usuario_id,
    usuario_email,
    accion,
    modulo,
    entidad_id,
    entidad_nombre,
    detalles
  ) VALUES (
    v_cotizacion.organization_id,
    auth.uid(),
    COALESCE(v_user_email, ''),
    CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END,
    'cotizaciones',
    p_cotizacion_id,
    COALESCE(v_cotizacion.folio, ''),
    jsonb_build_object(
      'cotizacion_id', p_cotizacion_id,
      'folio', v_cotizacion.folio,
      'cliente_id', v_cotizacion.cliente_id,
      'cliente_nombre', v_cotizacion.cliente_nombre,
      'estado_anterior', v_cotizacion.estado,
      'estado_nuevo', p_respuesta,
      'comentario_cliente', v_comentario,
      'origen', 'portal_cliente'
    )
  );

  RETURN jsonb_build_object(
    'id', p_cotizacion_id,
    'estado', p_respuesta,
    'fecha_respuesta', v_now
  );
END;
$$;