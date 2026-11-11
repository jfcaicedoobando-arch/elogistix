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

REVOKE ALL ON FUNCTION public.reservar_proforma_email(uuid, uuid, uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_proforma_email(uuid, uuid, uuid, uuid, jsonb, text) TO service_role;
