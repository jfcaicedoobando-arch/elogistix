CREATE OR REPLACE FUNCTION public.finalizar_evento_facturapi_webhook(
  p_evento_id uuid, p_token uuid, p_resultado text, p_motivo text DEFAULT NULL,
  p_tabla text DEFAULT NULL, p_documento_id uuid DEFAULT NULL, p_version timestamptz DEFAULT NULL,
  p_claim text DEFAULT NULL, p_patch jsonb DEFAULT NULL, p_accion text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_evento public.facturapi_webhook_eventos%ROWTYPE;
  v_momento timestamptz;
  v_estado text := p_resultado;
  v_motivo text := p_motivo;
  v_claim_actual text;
  v_version_actual timestamptz;
  v_patch jsonb := p_patch;
  v_permitidos text[];
  v_set text;
BEGIN
  SELECT * INTO v_evento FROM public.facturapi_webhook_eventos
   WHERE id = p_evento_id FOR UPDATE;
  v_momento := clock_timestamp();
  IF NOT FOUND OR v_evento.procesamiento_estado <> 'procesando'
    OR v_evento.procesamiento_token IS DISTINCT FROM p_token
    OR v_evento.procesamiento_disponible_en <= v_momento THEN
    RETURN jsonb_build_object('estado', 'reserva_perdida');
  END IF;

  IF p_resultado = 'aplicar' THEN
    IF p_tabla = 'facturas' THEN
      SELECT facturapi_id, updated_at INTO v_claim_actual, v_version_actual FROM public.facturas
       WHERE id = p_documento_id AND organization_id = v_evento.organization_id AND deleted_at IS NULL FOR UPDATE;
      v_permitidos := ARRAY['estado', 'cancellation_status', 'cancelado_en', 'cancelacion_solicitada_en',
        'cancelacion_vence_en', 'uuid_fiscal', 'uso_cfdi', 'enviada_cliente_at', 'facturapi_id',
        'facturapi_claim_at', 'facturapi_pendiente_id', 'facturapi_pendiente_at'];
    ELSIF p_tabla = 'pagos_factura' THEN
      SELECT facturapi_rep_id, updated_at INTO v_claim_actual, v_version_actual FROM public.pagos_factura
       WHERE id = p_documento_id AND organization_id = v_evento.organization_id AND deleted_at IS NULL FOR UPDATE;
      v_permitidos := ARRAY['uuid_rep', 'estado_rep', 'rep_cancelado_en', 'rep_cancellation_status',
        'timbrado_rep_en', 'facturapi_rep_id', 'facturapi_rep_claim_at', 'facturapi_rep_pendiente_id', 'facturapi_rep_pendiente_at'];
    ELSE
      RAISE EXCEPTION 'Destino de webhook inválido' USING ERRCODE = '22023';
    END IF;

    IF v_version_actual IS NULL OR v_claim_actual IS DISTINCT FROM p_claim THEN
      v_estado := 'ignorado';
      v_motivo := 'claim_cambiado';
    ELSIF v_version_actual IS DISTINCT FROM p_version THEN
      v_estado := 'reintentable';
      v_motivo := 'destino_actualizado';
    ELSE
      IF jsonb_typeof(v_patch) IS DISTINCT FROM 'object' OR p_accion IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(v_patch) AS campo WHERE campo <> ALL (v_permitidos)
      ) THEN
        RAISE EXCEPTION 'Patch de webhook inválido' USING ERRCODE = '22023';
      END IF;

      IF p_tabla = 'facturas' AND v_patch->>'cancellation_status' = 'accepted' THEN
        PERFORM public.cerrar_cancelacion_factura_facturapi(p_documento_id);
        v_patch := v_patch - ARRAY['estado', 'cancellation_status', 'cancelado_en', 'cancelacion_solicitada_en', 'cancelacion_vence_en'];
      END IF;
      -- Actualiza únicamente las columnas presentes en el patch validado.
      SELECT string_agg(format('%1$I = (jsonb_populate_record(NULL::public.%2$I, $1)).%1$I', campo, p_tabla), ', ')
        INTO v_set FROM jsonb_object_keys(v_patch) AS campo;
      IF v_set IS NOT NULL THEN
        EXECUTE format('UPDATE public.%I SET %s WHERE id = $2', p_tabla, v_set) USING v_patch, p_documento_id;
      END IF;

      INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
      VALUES (v_evento.organization_id, '00000000-0000-0000-0000-000000000000', 'system@edge', 'facturacion',
        p_accion, p_documento_id, '', jsonb_build_object('event_type', v_evento.event_type, 'event_id', v_evento.event_id, 'patch', p_patch));
      v_estado := 'procesado';
    END IF;
  ELSIF p_resultado IS NULL OR p_resultado NOT IN ('ignorado', 'reintentable') THEN
    RAISE EXCEPTION 'Resultado de webhook inválido' USING ERRCODE = '22023';
  END IF;

  UPDATE public.facturapi_webhook_eventos SET procesamiento_estado = v_estado, procesamiento_token = NULL,
    procesamiento_motivo = v_motivo,
    procesamiento_disponible_en = CASE WHEN v_estado = 'reintentable'
      THEN v_momento + make_interval(secs => 5 * (1 << least(v_evento.procesamiento_intentos, 8))) END,
    procesamiento_finalizado_en = CASE WHEN v_estado <> 'reintentable' THEN v_momento END
   WHERE id = v_evento.id;
  RETURN jsonb_build_object('estado', v_estado, 'motivo', v_motivo, 'tabla', p_tabla);
END;
$fn$;

REVOKE ALL ON FUNCTION public.finalizar_evento_facturapi_webhook(uuid, uuid, text, text, text, uuid, timestamptz, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalizar_evento_facturapi_webhook(uuid, uuid, text, text, text, uuid, timestamptz, text, jsonb, text) TO service_role;
