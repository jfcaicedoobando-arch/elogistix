CREATE TABLE public.proforma_email_intentos (
  id uuid PRIMARY KEY,
  proforma_id uuid NOT NULL REFERENCES public.proformas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  solicitud jsonb NOT NULL,
  contenido jsonb NOT NULL,
  reserva uuid,
  reserva_hasta timestamptz,
  resultado jsonb
);

CREATE INDEX proforma_email_intentos_proforma_idx ON public.proforma_email_intentos (proforma_id);
ALTER TABLE public.proforma_email_intentos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proforma_email_intentos FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reservar_proforma_email(
  p_proforma_id uuid, p_usuario_id uuid, p_intento uuid, p_reserva uuid,
  p_solicitud jsonb, p_portal_base text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_intento public.proforma_email_intentos%ROWTYPE;
  v_ahora timestamptz := clock_timestamp();
  v_dias integer := (p_solicitud->>'dias_vigencia')::integer;
BEGIN
  SELECT * INTO v_proforma FROM public.proformas
  WHERE id = p_proforma_id AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado', 'no_encontrada'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = p_usuario_id AND organization_id = v_proforma.organization_id
  ) THEN RETURN jsonb_build_object('estado', 'sin_acceso'); END IF;

  SELECT * INTO v_intento FROM public.proforma_email_intentos WHERE id = p_intento FOR UPDATE;
  IF FOUND THEN
    IF (v_intento.proforma_id, v_intento.usuario_id, v_intento.solicitud)
      IS DISTINCT FROM (p_proforma_id, p_usuario_id, p_solicitud) THEN
      RETURN jsonb_build_object('estado', 'intento_distinto');
    END IF;
    IF v_intento.resultado IS NOT NULL THEN
      RETURN jsonb_build_object('estado', 'confirmado', 'resultado', v_intento.resultado);
    END IF;
    IF v_intento.reserva_hasta > v_ahora THEN
      RETURN jsonb_build_object('estado', 'en_proceso');
    END IF;
  ELSE
    IF v_proforma.estado_proforma = 'cancelada' THEN
      RETURN jsonb_build_object('estado', 'cancelada');
    END IF;
    IF v_proforma.token_publico IS NULL OR v_proforma.token_expira_at IS NULL
      OR v_proforma.token_expira_at <= v_ahora THEN
      UPDATE public.proformas SET token_publico = gen_random_uuid(),
        token_expira_at = v_ahora + make_interval(days => v_dias)
      WHERE id = v_proforma.id RETURNING * INTO v_proforma;
    END IF;
    INSERT INTO public.proforma_email_intentos (id, proforma_id, usuario_id, solicitud, contenido)
    VALUES (p_intento, p_proforma_id, p_usuario_id, p_solicitud, jsonb_build_object(
      'token', v_proforma.token_publico, 'expira', v_proforma.token_expira_at,
      'enlace', rtrim(p_portal_base, '/') || '/portal/proformas/' || v_proforma.token_publico,
      'numero', v_proforma.numero, 'cliente', v_proforma.cliente_nombre, 'expediente', v_proforma.expediente,
      'total_mxn', v_proforma.total_mxn, 'total_usd', v_proforma.total_usd
    )) RETURNING * INTO v_intento;
  END IF;

  UPDATE public.proforma_email_intentos SET reserva = p_reserva,
    reserva_hasta = clock_timestamp() + interval '5 minutes'
  WHERE id = p_intento;
  RETURN jsonb_build_object('estado', 'reservado', 'contenido', v_intento.contenido);
END;
$$;

CREATE OR REPLACE FUNCTION public.finalizar_proforma_email(
  p_intento uuid, p_usuario_id uuid, p_reserva uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_intento public.proforma_email_intentos%ROWTYPE;
  v_resultados jsonb;
  v_enviados integer;
  v_pendientes integer;
  v_estado text;
  v_respuesta jsonb;
  v_enlace_invalido boolean;
BEGIN
  -- Mantener el mismo orden de bloqueos que la reserva.
  SELECT p.* INTO v_proforma FROM public.proformas p
  JOIN public.proforma_email_intentos i ON i.proforma_id = p.id
  WHERE i.id = p_intento AND i.usuario_id = p_usuario_id
    AND EXISTS (SELECT 1 FROM public.organization_members m
      WHERE m.user_id = p_usuario_id AND m.organization_id = p.organization_id)
  FOR UPDATE OF p;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado', 'sin_acceso'); END IF;
  SELECT * INTO v_intento FROM public.proforma_email_intentos WHERE id = p_intento FOR UPDATE;
  IF v_intento.resultado IS NOT NULL THEN RETURN v_intento.resultado; END IF;
  v_enlace_invalido := v_proforma.deleted_at IS NOT NULL OR v_proforma.estado_proforma = 'cancelada'
    OR v_proforma.token_publico::text IS DISTINCT FROM v_intento.contenido->>'token'
    OR coalesce(v_proforma.token_expira_at <= clock_timestamp(), true);

  SELECT jsonb_agg(jsonb_build_object('email', r.dato->>'email', 'tipo', r.dato->>'tipo',
    'estado', CASE l.status WHEN 'sent' THEN 'enviado' WHEN 'suppressed' THEN 'suprimido'
      ELSE CASE WHEN v_enlace_invalido THEN 'sin_confirmar' ELSE 'pendiente' END END
  ) ORDER BY r.posicion), count(*) FILTER (WHERE l.status = 'sent'),
    count(*) FILTER (WHERE l.status IS NULL OR l.status NOT IN ('sent', 'suppressed'))
  INTO v_resultados, v_enviados, v_pendientes
  FROM jsonb_array_elements(v_intento.solicitud->'recipients') WITH ORDINALITY AS r(dato, posicion)
  LEFT JOIN public.email_send_log l ON l.message_id = 'proforma:' || p_intento || ':' || r.posicion;

  v_estado := CASE
    WHEN v_intento.reserva IS DISTINCT FROM p_reserva OR p_reserva IS NULL THEN 'pendiente'
    WHEN v_pendientes > 0 AND NOT v_enlace_invalido THEN 'pendiente'
    WHEN v_enviados = jsonb_array_length(v_resultados) THEN 'enviado'
    WHEN v_enviados > 0 THEN 'parcial'
    ELSE 'fallido'
  END;

  v_respuesta := jsonb_build_object(
    'success', v_enviados > 0, 'estado', v_estado, 'envio_id', p_intento, 'resultados', v_resultados,
    'enlace_portal', CASE WHEN NOT v_enlace_invalido THEN v_intento.contenido->>'enlace' END,
    'token_expira_at', v_intento.contenido->>'expira'
  );
  IF p_reserva IS NOT NULL AND v_intento.reserva = p_reserva THEN
    IF v_estado <> 'pendiente' THEN
      INSERT INTO public.proforma_envios (
        id, proforma_id, organization_id, enviado_por, destinatarios, cc, asunto, mensaje,
        pdf_link_publico, estado, error
      ) VALUES (
        p_intento, v_proforma.id, v_proforma.organization_id, p_usuario_id,
        v_intento.solicitud->'destinatarios', v_intento.solicitud->'cc',
        v_intento.solicitud->>'asunto', v_intento.solicitud->>'mensaje',
        v_intento.contenido->>'enlace', v_estado,
        CASE WHEN v_estado <> 'enviado' THEN v_resultados::text END
      );
      IF v_enviados > 0 THEN
        UPDATE public.proformas SET enviada_at = clock_timestamp(), enviada_por = p_usuario_id,
          ultimo_envio_email = v_intento.solicitud->'destinatarios'->0->>'email'
        WHERE id = v_proforma.id AND deleted_at IS NULL AND estado_proforma <> 'cancelada';
      END IF;
      INSERT INTO public.bitacora_actividad (
        organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles
      ) VALUES (
        v_proforma.organization_id, p_usuario_id,
        coalesce((SELECT email FROM auth.users WHERE id = p_usuario_id), ''), 'proformas',
        CASE WHEN v_enviados > 0 THEN 'proforma_enviada_email' ELSE 'proforma_envio_email_fallido' END,
        v_proforma.id, coalesce(v_proforma.numero, ''),
        jsonb_build_object('envio_id', p_intento, 'resultados', v_resultados)
      );
      UPDATE public.proforma_email_intentos SET resultado = v_respuesta WHERE id = p_intento;
    END IF;
    UPDATE public.proforma_email_intentos SET reserva = NULL, reserva_hasta = NULL WHERE id = p_intento;
  END IF;

  RETURN v_respuesta;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_proforma_email(uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalizar_proforma_email(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_proforma_email(uuid, uuid, uuid, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalizar_proforma_email(uuid, uuid, uuid) TO service_role;
