
-- Portal público de proformas (Fase 2)

-- 1) Campos de token público en proformas
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS token_publico uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS token_expira_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_proformas_token_publico ON public.proformas (token_publico) WHERE token_publico IS NOT NULL;

-- 2) Generar/rotar token (interno)
CREATE OR REPLACE FUNCTION public.generar_token_proforma(
  p_proforma_id uuid,
  p_dias_vigencia integer DEFAULT 30
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_token uuid := gen_random_uuid();
  v_expira timestamptz := now() + make_interval(days => GREATEST(1, p_dias_vigencia));
BEGIN
  SELECT * INTO v_proforma FROM public.proformas WHERE id = p_proforma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;

  -- Solo miembros de la org pueden generar token
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = auth.uid() AND om.organization_id = v_proforma.organization_id
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a esta proforma.';
  END IF;

  UPDATE public.proformas
     SET token_publico = v_token,
         token_expira_at = v_expira,
         updated_at = now()
   WHERE id = p_proforma_id;

  RETURN jsonb_build_object('token', v_token, 'expira_at', v_expira);
END $$;

REVOKE ALL ON FUNCTION public.generar_token_proforma(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generar_token_proforma(uuid, integer) TO authenticated;

-- 3) Obtener proforma por token (público, sanitizada)
CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_conceptos jsonb;
  v_estado_link text;
BEGIN
  IF p_token IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_proforma FROM public.proformas WHERE token_publico = p_token;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','token_invalido'); END IF;

  IF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    v_estado_link := 'expirado';
  ELSIF v_proforma.estado_cliente <> 'pendiente' THEN
    v_estado_link := 'respondida';
  ELSE
    v_estado_link := 'activo';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pcc.id,
    'descripcion', pcc.descripcion,
    'cantidad', pcc.cantidad,
    'precio_unitario', pcc.precio_unitario,
    'importe', pcc.importe,
    'moneda', pcc.moneda
  ) ORDER BY pcc.created_at), '[]'::jsonb)
    INTO v_conceptos
    FROM public.proforma_conceptos_consolidados pcc
   WHERE pcc.proforma_id = v_proforma.id;

  RETURN jsonb_build_object(
    'estado_link', v_estado_link,
    'proforma', jsonb_build_object(
      'id', v_proforma.id,
      'numero', v_proforma.numero,
      'cliente_nombre', v_proforma.cliente_nombre,
      'expediente', v_proforma.expediente,
      'moneda', v_proforma.moneda,
      'subtotal', v_proforma.subtotal,
      'iva', v_proforma.iva,
      'total', v_proforma.total,
      'estado_cliente', v_proforma.estado_cliente,
      'aceptada_at', v_proforma.aceptada_at,
      'rechazada_at', v_proforma.rechazada_at,
      'motivo_rechazo', v_proforma.motivo_rechazo,
      'created_at', v_proforma.created_at,
      'token_expira_at', v_proforma.token_expira_at
    ),
    'conceptos', v_conceptos
  );
END $$;

REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated;

-- 4) Responder proforma por token (público)
CREATE OR REPLACE FUNCTION public.portal_responder_por_token(
  p_token uuid, p_respuesta text, p_motivo text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_now timestamptz := now();
  v_motivo text;
  v_titulo text; v_mensaje text; v_tipo text;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;

  SELECT * INTO v_proforma FROM public.proformas WHERE token_publico = p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enlace inválido.'; END IF;

  IF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    RAISE EXCEPTION 'El enlace ha expirado. Solicita uno nuevo a tu ejecutivo.';
  END IF;

  IF v_proforma.estado_cliente <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida (%).', v_proforma.estado_cliente;
  END IF;

  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN 'cliente_portal_token' ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = v_proforma.id;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, NULL, '',
          CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada_cliente' ELSE 'proforma_rechazada_cliente' END,
          'proformas', v_proforma.id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', v_proforma.id, 'numero', v_proforma.numero,
                             'cliente_id', v_proforma.cliente_id, 'cliente_nombre', v_proforma.cliente_nombre,
                             'respuesta', p_respuesta, 'motivo', v_motivo, 'origen','portal_token'));

  v_tipo := CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada' ELSE 'proforma_rechazada' END;
  v_titulo := 'Proforma ' || COALESCE(v_proforma.numero,'') || ' ' ||
              CASE WHEN p_respuesta='aceptada' THEN 'aceptada por el cliente' ELSE 'rechazada por el cliente' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_proforma.cliente_nombre,'N/D') ||
               CASE WHEN v_motivo IS NOT NULL THEN E'\nMotivo: ' || v_motivo ELSE '' END;

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v_proforma.organization_id, om.user_id, v_tipo, v_titulo, v_mensaje,
         '/proformas/' || v_proforma.id::text, 'proforma', v_proforma.id
    FROM public.organization_members om
   WHERE om.organization_id = v_proforma.organization_id
     AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role);

  RETURN jsonb_build_object('id', v_proforma.id, 'estado_cliente', p_respuesta, 'respondida_at', v_now);
END $$;

REVOKE ALL ON FUNCTION public.portal_responder_por_token(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO anon, authenticated;
