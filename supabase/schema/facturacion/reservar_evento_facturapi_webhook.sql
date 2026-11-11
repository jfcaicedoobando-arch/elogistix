CREATE OR REPLACE FUNCTION public.reservar_evento_facturapi_webhook(
  p_organization_id uuid, p_event_id text, p_payload jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_evento public.facturapi_webhook_eventos%ROWTYPE;
  v_momento timestamptz := clock_timestamp();
  v_token uuid := gen_random_uuid();
BEGIN
  IF p_payload IS NOT NULL THEN
    INSERT INTO public.facturapi_webhook_eventos (organization_id, event_id, event_type, payload,
      procesamiento_estado, procesamiento_disponible_en)
    VALUES (p_organization_id, p_event_id, p_payload->>'type', p_payload, 'reintentable', v_momento)
    ON CONFLICT (organization_id, event_id) DO NOTHING;
  END IF;

  SELECT * INTO v_evento FROM public.facturapi_webhook_eventos
   WHERE organization_id = p_organization_id AND event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('estado', 'ausente'); END IF;
  v_momento := clock_timestamp();
  IF v_evento.procesamiento_estado NOT IN ('procesando', 'reintentable') THEN
    RETURN jsonb_build_object('estado', 'terminado', 'resultado', v_evento.procesamiento_estado);
  END IF;
  IF v_evento.procesamiento_disponible_en > v_momento THEN
    RETURN jsonb_build_object('estado', 'ocupado');
  END IF;
  IF v_evento.received_at < v_momento - interval '7 days' THEN
    UPDATE public.facturapi_webhook_eventos SET procesamiento_estado = 'agotado',
      procesamiento_token = NULL, procesamiento_disponible_en = NULL, procesamiento_finalizado_en = v_momento
     WHERE id = v_evento.id;
    RETURN jsonb_build_object('estado', 'terminado', 'resultado', 'agotado');
  END IF;

  UPDATE public.facturapi_webhook_eventos SET procesamiento_estado = 'procesando',
    procesamiento_token = v_token, procesamiento_disponible_en = v_momento + interval '2 minutes',
    procesamiento_intentos = procesamiento_intentos + 1
   WHERE id = v_evento.id;
  RETURN jsonb_build_object('estado', 'tomado', 'id', v_evento.id, 'token', v_token, 'payload', v_evento.payload);
END;
$fn$;

REVOKE ALL ON FUNCTION public.reservar_evento_facturapi_webhook(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_evento_facturapi_webhook(uuid, text, jsonb) TO service_role;
