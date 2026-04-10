
ALTER TABLE public.cotizaciones ADD COLUMN comentario_cliente text;

CREATE OR REPLACE FUNCTION public.portal_responder_cotizacion(p_cotizacion_id uuid, p_respuesta text, p_comentario text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cotizacion cotizaciones%ROWTYPE;
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

  UPDATE cotizaciones
  SET estado = p_respuesta::estado_cotizacion,
      comentario_cliente = NULLIF(trim(p_comentario), ''),
      updated_at = now()
  WHERE id = p_cotizacion_id;

  RETURN jsonb_build_object('id', p_cotizacion_id, 'estado', p_respuesta);
END;
$$;
