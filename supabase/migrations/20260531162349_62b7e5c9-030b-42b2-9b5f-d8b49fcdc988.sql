
-- Fase 2: Tabla de notificaciones internas

CREATE TABLE IF NOT EXISTS public.notificaciones_internas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text NOT NULL,
  enlace text NULL,
  entidad_tipo text NULL,
  entidad_id uuid NULL,
  leida boolean NOT NULL DEFAULT false,
  leida_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notificaciones_internas TO authenticated;
GRANT ALL ON public.notificaciones_internas TO service_role;

ALTER TABLE public.notificaciones_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notificaciones_internas
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.notificaciones_internas
  FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_notif_internas_usuario_leida_created
  ON public.notificaciones_internas (usuario_id, leida, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones_internas;
ALTER TABLE public.notificaciones_internas REPLICA IDENTITY FULL;

-- Extender RPC portal_responder_cotizacion para crear notificaciones in-app
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
  v_titulo text;
  v_mensaje text;
  v_tipo text;
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

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo,
    entidad_id, entidad_nombre, detalles
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

  -- Notificaciones in-app a operadores y admins de la organización
  v_tipo := CASE WHEN p_respuesta = 'Aceptada' THEN 'cotizacion_aceptada' ELSE 'cotizacion_rechazada' END;
  v_titulo := 'Cotización ' || COALESCE(v_cotizacion.folio, '') || ' ' ||
              CASE WHEN p_respuesta = 'Aceptada' THEN 'aceptada' ELSE 'rechazada' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_cotizacion.cliente_nombre, 'N/D') ||
               CASE WHEN v_comentario IS NOT NULL THEN E'\nComentario: ' || v_comentario ELSE '' END;

  INSERT INTO public.notificaciones_internas (
    organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id
  )
  SELECT
    v_cotizacion.organization_id,
    om.user_id,
    v_tipo,
    v_titulo,
    v_mensaje,
    '/cotizaciones/' || p_cotizacion_id::text,
    'cotizacion',
    p_cotizacion_id
  FROM public.organization_members om
  WHERE om.organization_id = v_cotizacion.organization_id
    AND om.role IN ('admin'::app_role, 'operador'::app_role);

  RETURN jsonb_build_object(
    'id', p_cotizacion_id,
    'estado', p_respuesta,
    'fecha_respuesta', v_now
  );
END;
$$;
