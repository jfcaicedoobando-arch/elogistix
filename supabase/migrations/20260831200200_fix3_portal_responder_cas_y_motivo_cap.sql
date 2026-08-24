-- ============================================================================
-- fix3 (tanda 3) — portal_responder_por_token: cierra el TOCTOU, acota el
-- motivo de rechazo y corrige la bitácora con usuario NULL.
--
-- Hallazgos (bugs2/public_surface_hunter.md, P3): la función leía la proforma
-- sin FOR UPDATE y actualizaba sin condición de estado en el WHERE, así dos
-- respuestas concurrentes con el mismo token pasaban ambas el check
-- `estado_cliente = 'pendiente'` → doble liberar_conceptos_de_proforma, doble
-- notificación a la org y "aceptada" podía ganar sobre "rechazada" por último
-- escritor. Además p_motivo era text sin límite y se copiaba a bitácora,
-- notificaciones y emails.
--
-- Encontrado al probar: el INSERT en bitacora_actividad usaba usuario_id NULL
-- pero la columna es NOT NULL desde 20260301200638, así que la respuesta del
-- cliente reventaba al final de la función (tras el UPDATE) en cualquier base
-- canonizada. Se usa el sentinel de sistema '00000000-…' (patrón existente,
-- ver 20260717025858).
--
-- Fix:
--   1. SELECT ... FOR UPDATE (serializa respuestas concurrentes del mismo
--      token) + UPDATE compare-and-set con `AND estado_cliente = 'pendiente'`
--      en el WHERE: si 0 filas, la proforma ya fue respondida.
--   2. p_motivo queda acotado a 1000 caracteres (LEFT(btrim(...), 1000)).
--   3. Bitácora con usuario sentinel (ver arriba).
--
-- Cuerpo idéntico al vigente (20260811231247) salvo los bloques marcados.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.portal_responder_por_token(
  p_token uuid,
  p_respuesta text,
  p_motivo text DEFAULT ''::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma  public.proformas%ROWTYPE;
  v_now       timestamptz := now();
  v_motivo    text;
  v_titulo    text; v_mensaje text; v_tipo text;
  v_liberados integer := 0;
  v_rl        jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:portal_responder_por_token:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 10
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  IF p_respuesta NOT IN ('aceptada','rechazada') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;

  -- fix3: FOR UPDATE serializa respuestas concurrentes del mismo token; la
  -- segunda espera el commit de la primera y ve el estado ya respondido.
  SELECT * INTO v_proforma FROM public.proformas WHERE token_publico = p_token FOR UPDATE;
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

  -- fix3: motivo acotado a 1000 caracteres (se copia a bitácora,
  -- notificaciones y emails; antes era text sin límite).
  v_motivo := NULLIF(LEFT(btrim(COALESCE(p_motivo, '')), 1000), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  -- fix3: compare-and-set atómico — si otra respuesta ganó la carrera entre
  -- el SELECT y este UPDATE, 0 filas y se reporta como ya respondida.
  UPDATE public.proformas
     SET estado_cliente = p_respuesta,
         aceptada_at    = CASE WHEN p_respuesta='aceptada'  THEN v_now ELSE aceptada_at END,
         rechazada_at   = CASE WHEN p_respuesta='rechazada' THEN v_now ELSE rechazada_at END,
         aceptada_por   = CASE WHEN p_respuesta='aceptada'  THEN 'cliente_portal_token'
                               WHEN p_respuesta='rechazada' THEN 'cliente_portal_token'
                               ELSE aceptada_por END,
         motivo_rechazo = CASE WHEN p_respuesta='rechazada' THEN v_motivo ELSE motivo_rechazo END,
         updated_at = v_now
   WHERE id = v_proforma.id
     AND estado_cliente = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta proforma ya fue respondida por otra solicitud concurrente.';
  END IF;

  IF p_respuesta = 'rechazada' THEN
    v_liberados := public.liberar_conceptos_de_proforma(v_proforma.id);
  END IF;

  -- fix3: usuario sentinel en vez de NULL — bitacora_actividad.usuario_id es
  -- NOT NULL (20260301200638). Mismo patrón que otras escrituras de sistema
  -- ('00000000-…', ver 20260717025858).
  INSERT INTO public.bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_proforma.organization_id, '00000000-0000-0000-0000-000000000000'::uuid, 'cliente-portal-token',
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
END $function$;

-- Permisos: se re-declaran tal cual (CREATE OR REPLACE preserva ACLs).
REVOKE ALL ON FUNCTION public.portal_responder_por_token(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO anon, authenticated, service_role;
