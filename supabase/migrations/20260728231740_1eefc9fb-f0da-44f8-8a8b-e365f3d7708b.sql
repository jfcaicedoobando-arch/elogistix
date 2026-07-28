-- Guardrail: bloquear respuesta de cliente sobre proformas en papelera.
-- Contexto: PRO-2026-0989 (borrada el 2026-07-20) fue marcada "aceptada" el
-- 2026-07-28 porque la UI antigua listaba filas con deleted_at.

CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma      public.proformas%ROWTYPE;
  v_user_email    text;
  v_now           timestamptz := now();
  v_motivo        text;
  v_is_authorized boolean;
  v_liberados     integer := 0;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada','pendiente') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;

  SELECT * INTO v_proforma FROM public.proformas WHERE id = p_proforma_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proforma no encontrada.'; END IF;

  IF v_proforma.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta proforma está en la papelera; restáurala antes de cambiar su estado.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = v_proforma.organization_id
       AND om.role IN (
         'admin'::app_role,
         'admin_org'::app_role,
         'gerente_operaciones'::app_role,
         'gerente_comercial'::app_role
       )
  ) OR public.has_role(auth.uid(), 'super_admin'::app_role) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el estado del cliente en esta proforma.';
  END IF;

  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  IF p_respuesta = 'rechazada' AND v_proforma.estado_proforma = 'facturada' THEN
    RAISE EXCEPTION 'No puedes rechazar una proforma que ya fue facturada.';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada' THEN v_now
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'
                                 THEN 'manual:' || COALESCE(v_user_email, auth.uid()::text)
                               WHEN p_respuesta='rechazada'
                                 THEN 'manual:' || COALESCE(v_user_email, auth.uid()::text)
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo
                               WHEN p_respuesta='pendiente' THEN NULL
                               ELSE motivo_rechazo END,
         updated_at     = v_now
   WHERE id = p_proforma_id;

  IF p_respuesta = 'rechazada' AND v_proforma.estado_cliente <> 'rechazada' THEN
    v_liberados := public.liberar_conceptos_de_proforma(p_proforma_id);
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, auth.uid(), COALESCE(v_user_email,''),
          'proforma_estado_cliente_manual', 'proformas', p_proforma_id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', p_proforma_id,
                             'estado_anterior', v_proforma.estado_cliente,
                             'estado_nuevo', p_respuesta,
                             'motivo', v_motivo,
                             'conceptos_liberados', v_liberados,
                             'origen','manual_interno'));

  RETURN jsonb_build_object(
    'id', p_proforma_id,
    'estado_cliente', p_respuesta,
    'at', v_now,
    'conceptos_liberados', v_liberados
  );
END;
$function$;
