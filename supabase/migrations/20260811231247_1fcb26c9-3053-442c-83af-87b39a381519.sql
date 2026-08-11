-- rate_limit_anon_rpcs
-- Añade rate-limit a nivel BD a las 4 RPCs ejecutables por el rol `anon`
-- (whitelist FIX-45), reutilizando public.check_ratelimit(text, int, int)
-- (tabla ratelimit_buckets, SECURITY DEFINER, ya con GRANT a anon).
--
-- Patrón (idéntico al de los edge functions, pero fail-CLOSED en SQL):
--   1) clave = 'rpc:<nombre>:' || IP (x-forwarded-for de request.headers) ||
--      identidad (auth.uid() si hay JWT, 'anon' si no)
--   2) v_rl := public.check_ratelimit(clave, ventana, max)
--   3) si (v_rl->>'ok') = 'false' -> RAISE EXCEPTION P0001 con retry_after
--
-- NOTA de volatilidad: get_tracking_public y portal_obtener_proforma_por_token
-- estaban marcadas STABLE. check_ratelimit escribe en ratelimit_buckets y
-- Postgres prohíbe escrituras dentro de funciones no-VOLATILE, por lo que
-- ambas pasan a VOLATILE (default). Es el único cambio de firma; lógica,
-- permisos, SECURITY DEFINER y search_path se preservan íntegros.
--
-- NOTA demo_leads: la política de INSERT anon (WITH CHECK con validaciones de
-- formato) es la única vía de alta; NO existe función/RPC de inserción de leads
-- en el esquema, así que no hay cuerpo donde insertar check_ratelimit. Las
-- políticas y GRANTs quedan intactos. Si en el futuro se crea una RPC
-- `demo_lead_*`, debe seguir este mismo patrón.

-- 1) log_client_error_v1 — 20 errores por minuto y por IP/identidad.
CREATE OR REPLACE FUNCTION public.log_client_error_v1(
  p_message text,
  p_stack text DEFAULT NULL::text,
  p_component_stack text DEFAULT NULL::text,
  p_route text DEFAULT NULL::text,
  p_user_agent text DEFAULT NULL::text,
  p_app_version text DEFAULT NULL::text,
  p_request_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
  v_rl jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:log_client_error_v1:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(v_user::text, 'anon'),
    60, 20
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.app_logs(level, fn, msg, request_id, user_id, status_code, latency_ms, payload)
  VALUES (
    'error', 'client',
    LEFT(COALESCE(p_message, '(sin mensaje)'), 1000),
    COALESCE(p_request_id, gen_random_uuid()),
    v_user,
    500, NULL,
    jsonb_build_object(
      'stack', LEFT(COALESCE(p_stack, ''), 8000),
      'component_stack', LEFT(COALESCE(p_component_stack, ''), 4000),
      'route', LEFT(COALESCE(p_route, ''), 500),
      'user_agent', LEFT(COALESCE(p_user_agent, ''), 500),
      'app_version', LEFT(COALESCE(p_app_version, ''), 50)
    )
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- 2) get_tracking_public — 60 consultas por minuto y por IP/identidad.
CREATE OR REPLACE FUNCTION public.get_tracking_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_link RECORD;
  v_embarque jsonb;
  v_eventos jsonb;
  v_org jsonb;
  v_rl jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:get_tracking_public:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 60
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_link FROM public.tracking_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT to_jsonb(e) - 'created_at' - 'updated_at' INTO v_embarque
  FROM (
    SELECT id, expediente, cliente_nombre, modo, tipo, estado, etd, eta,
           puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino,
           ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga,
           naviera, aerolinea, transportista
    FROM public.embarques WHERE id = v_link.embarque_id AND deleted_at IS NULL
  ) e;
  IF v_embarque IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tipo', tipo, 'descripcion', descripcion, 'ubicacion', ubicacion, 'fecha', fecha
  ) ORDER BY fecha DESC), '[]'::jsonb)
  INTO v_eventos
  FROM public.eventos_embarque WHERE embarque_id = v_link.embarque_id;

  SELECT jsonb_build_object('nombre', nombre, 'logo_url', logo_url) INTO v_org
  FROM public.organizations WHERE id = v_link.organization_id;

  RETURN jsonb_build_object('embarque', v_embarque, 'eventos', v_eventos, 'organizacion', v_org);
END;
$function$;

-- 3a) portal_obtener_proforma_por_token — 30 lecturas por minuto.
CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_conceptos jsonb;
  v_estado_link text;
  v_rl jsonb;
BEGIN
  v_rl := public.check_ratelimit(
    'rpc:portal_obtener_proforma_por_token:'
      || COALESCE(NULLIF(current_setting('request.headers', true)::jsonb->>'x-forwarded-for', ''), 'sin-ip')
      || ':' || COALESCE(auth.uid()::text, 'anon'),
    60, 30
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

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

  -- 13.320.2 (audit RPC columns): proforma_conceptos_consolidados no tiene
  -- `importe`; el equivalente es `total`. Se expone bajo el alias `importe`
  -- para preservar el contrato del portal público.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pcc.id,
    'descripcion', pcc.descripcion,
    'cantidad', pcc.cantidad,
    'precio_unitario', pcc.precio_unitario,
    'importe', pcc.total,
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
END $function$;

-- 3b) portal_responder_por_token — 10 respuestas por minuto (escritura).
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
END $function$;