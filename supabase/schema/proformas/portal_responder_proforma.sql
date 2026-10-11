-- Candidato forward 20261011180000; CREATE OR REPLACE conserva ACL.
CREATE OR REPLACE FUNCTION public.portal_responder_proforma(p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_user_email text;
  v_now timestamptz := now();
  v_motivo text;
  v_titulo text; v_mensaje text; v_tipo text;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida. Debe ser aceptada o rechazada.';
  END IF;
  SELECT * INTO v_proforma FROM public.proformas
   WHERE id = p_proforma_id AND cliente_id IN (SELECT current_user_client_ids()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada o no tienes acceso.'; END IF;
  IF v_proforma.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: la proforma fue eliminada' USING ERRCODE='P0001';
  END IF;
  IF v_proforma.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para continuar' USING ERRCODE='P0001';
  END IF;
  IF v_proforma.estado_cliente <> 'pendiente' THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida (estado: %).', v_proforma.estado_cliente;
  END IF;
  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN COALESCE(v_user_email, auth.uid()::text) ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = p_proforma_id;
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, auth.uid(), COALESCE(v_user_email,''),
          CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada_cliente' ELSE 'proforma_rechazada_cliente' END,
          'proformas', p_proforma_id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', p_proforma_id, 'numero', v_proforma.numero,
                             'cliente_id', v_proforma.cliente_id, 'cliente_nombre', v_proforma.cliente_nombre,
                             'respuesta', p_respuesta, 'motivo', v_motivo, 'origen','portal_cliente'));
  v_tipo := CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada' ELSE 'proforma_rechazada' END;
  v_titulo := 'Proforma ' || COALESCE(v_proforma.numero,'') || ' ' ||
              CASE WHEN p_respuesta='aceptada' THEN 'aceptada por el cliente' ELSE 'rechazada por el cliente' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_proforma.cliente_nombre,'N/D') ||
               CASE WHEN v_motivo IS NOT NULL THEN E'\nMotivo: ' || v_motivo ELSE '' END;
  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v_proforma.organization_id, om.user_id, v_tipo, v_titulo, v_mensaje,
         '/proformas/' || p_proforma_id::text, 'proforma', p_proforma_id
    FROM public.organization_members om
   WHERE om.organization_id = v_proforma.organization_id
     AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role);
  RETURN jsonb_build_object('id', p_proforma_id, 'estado_cliente', p_respuesta, 'respondida_at', v_now);
END $$;
