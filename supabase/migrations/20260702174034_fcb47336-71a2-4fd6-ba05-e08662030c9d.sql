
-- ============================================================================
-- 1. Helper: liberar conceptos de una proforma rechazada
-- ============================================================================
CREATE OR REPLACE FUNCTION public.liberar_conceptos_de_proforma(p_proforma_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embarque_id uuid;
  v_liberados   integer := 0;
BEGIN
  SELECT embarque_id INTO v_embarque_id FROM public.proformas WHERE id = p_proforma_id;
  IF v_embarque_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH upd AS (
    UPDATE public.conceptos_venta
       SET proforma_id = NULL,
           estado_facturacion = 'pendiente'
     WHERE proforma_id = p_proforma_id
    RETURNING id
  )
  SELECT COUNT(*) INTO v_liberados FROM upd;

  -- Recalcula tiene_proforma: true solo si queda otra proforma viva en el embarque.
  UPDATE public.embarques e
     SET tiene_proforma = EXISTS (
       SELECT 1 FROM public.proformas p
        WHERE p.embarque_id = e.id
          AND p.id <> p_proforma_id
          AND COALESCE(p.estado_cliente, 'pendiente') <> 'rechazada'
     )
   WHERE e.id = v_embarque_id;

  RETURN v_liberados;
END;
$$;

REVOKE ALL ON FUNCTION public.liberar_conceptos_de_proforma(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_conceptos_de_proforma(uuid) TO service_role;

-- ============================================================================
-- 2. RPC manual interno: extender para liberar y bloquear post-facturación
-- ============================================================================
CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(
  p_proforma_id uuid,
  p_respuesta   text,
  p_motivo      text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
     WHERE om.user_id = auth.uid()
       AND om.organization_id = v_proforma.organization_id
       AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'contador'::app_role, 'operador'::app_role)
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

  -- Liberar conceptos cuando el estado cambia a rechazada
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
END $$;

-- ============================================================================
-- 3. RPC portal público: extender para liberar y bloquear post-facturación
-- ============================================================================
CREATE OR REPLACE FUNCTION public.portal_responder_por_token(
  p_token     uuid,
  p_respuesta text,
  p_motivo    text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proforma  public.proformas%ROWTYPE;
  v_now       timestamptz := now();
  v_motivo    text;
  v_titulo    text; v_mensaje text; v_tipo text;
  v_liberados integer := 0;
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

  IF p_respuesta = 'rechazada' AND v_proforma.estado_proforma = 'facturada' THEN
    RAISE EXCEPTION 'No puedes rechazar una proforma que ya fue facturada.';
  END IF;

  v_motivo := NULLIF(trim(p_motivo), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN 'cliente_portal_token'
                               WHEN p_respuesta='rechazada' THEN 'cliente_portal_token'
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = v_proforma.id;

  IF p_respuesta = 'rechazada' THEN
    v_liberados := public.liberar_conceptos_de_proforma(v_proforma.id);
  END IF;

  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, NULL, '',
          CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada_cliente' ELSE 'proforma_rechazada_cliente' END,
          'proformas', v_proforma.id, COALESCE(v_proforma.numero,''),
          jsonb_build_object('proforma_id', v_proforma.id, 'numero', v_proforma.numero,
                             'cliente_id', v_proforma.cliente_id, 'cliente_nombre', v_proforma.cliente_nombre,
                             'respuesta', p_respuesta, 'motivo', v_motivo,
                             'conceptos_liberados', v_liberados,
                             'origen','portal_token'));

  v_tipo := CASE WHEN p_respuesta='aceptada' THEN 'proforma_aceptada' ELSE 'proforma_rechazada' END;
  v_titulo := 'Proforma ' || COALESCE(v_proforma.numero,'') || ' ' ||
              CASE WHEN p_respuesta='aceptada' THEN 'aceptada por el cliente' ELSE 'rechazada por el cliente' END;
  v_mensaje := 'Cliente: ' || COALESCE(v_proforma.cliente_nombre,'N/D') ||
               CASE WHEN v_motivo IS NOT NULL THEN E'\nMotivo: ' || v_motivo ELSE '' END ||
               CASE WHEN p_respuesta='rechazada' AND v_liberados > 0
                    THEN E'\nSe liberaron ' || v_liberados || ' concepto(s) para regenerar la proforma.'
                    ELSE '' END;

  INSERT INTO public.notificaciones_internas (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  SELECT v_proforma.organization_id, om.user_id, v_tipo, v_titulo, v_mensaje,
         '/proformas/' || v_proforma.id::text, 'proforma', v_proforma.id
    FROM public.organization_members om
   WHERE om.organization_id = v_proforma.organization_id
     AND om.role IN ('admin'::app_role, 'admin_org'::app_role, 'operador'::app_role, 'contador'::app_role);

  RETURN jsonb_build_object(
    'id', v_proforma.id,
    'estado_cliente', p_respuesta,
    'respondida_at', v_now,
    'conceptos_liberados', v_liberados
  );
END $$;

-- ============================================================================
-- 4. Backfill one-shot: liberar conceptos de proformas ya rechazadas
-- ============================================================================
DO $$
DECLARE
  r record;
  v_total integer := 0;
  v_n     integer;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
      FROM public.proformas p
      JOIN public.conceptos_venta cv ON cv.proforma_id = p.id
     WHERE p.estado_cliente = 'rechazada'
  LOOP
    v_n := public.liberar_conceptos_de_proforma(r.id);
    v_total := v_total + v_n;
  END LOOP;
  RAISE NOTICE 'Backfill: se liberaron % conceptos de proformas previamente rechazadas.', v_total;
END $$;
