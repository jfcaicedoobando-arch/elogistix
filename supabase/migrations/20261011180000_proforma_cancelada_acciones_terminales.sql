-- Candidato local: acciones terminales de proformas canceladas.
-- Sólo reemisiones completas, sin backfill, GRANT/REVOKE, roles, RLS ni versión.
-- H6 requiere revisión explícita de preservación de ACL antes de integración.
BEGIN;
-- Accept only reviewed catalog profiles, without rewriting any ACL.
-- Hosted trigger differs only by explicit service_role EXECUTE; no other superset is allowed.
DO $catalog$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('public.aceptar_proforma_sin_autorizacion(uuid)', true, '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.actualizar_estado_cliente_proforma(uuid,text,text)', true, '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.consolidar_proformas(uuid,uuid,text,text,text,text,integer,uuid,uuid[],numeric,uuid)', true, '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)', true, '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.enforce_proforma_aceptada_before_factura()', false, '{=X/postgres,postgres=X/postgres,authenticated=X/postgres}'::aclitem[]),
      ('public.portal_obtener_proforma_por_token(uuid)', true, '{postgres=X/postgres,authenticated=X/postgres,anon=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.portal_responder_por_token(uuid,text,text)', true, '{postgres=X/postgres,authenticated=X/postgres,anon=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.portal_responder_proforma(uuid,text,text)', true, '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]),
      ('public.tg_facturas_link_proforma()', true, '{postgres=X/postgres,service_role=X/postgres}'::aclitem[])
    ) expected(signature, security_definer, acl)
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR pg_get_userbyid(p.proowner)<>'postgres'
      OR p.prosecdef IS DISTINCT FROM expected.security_definer
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR p.proacl IS NULL
      OR NOT (
        (p.proacl @> expected.acl AND p.proacl <@ expected.acl)
        OR (
          expected.signature = 'public.enforce_proforma_aceptada_before_factura()'
          AND p.proacl @> '{=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
          AND p.proacl <@ '{=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]
        )
      )
  ) THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_CATALOG: owner, ACL, security o search_path inesperado';
  END IF;
END $catalog$;
CREATE TEMP TABLE proforma_cancelada_metadata ON COMMIT DROP AS
SELECT p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.prorettype, p.proargtypes
FROM pg_proc p WHERE p.oid IN (to_regprocedure('public.actualizar_estado_cliente_proforma(uuid,text,text)'),to_regprocedure('public.aceptar_proforma_sin_autorizacion(uuid)'),to_regprocedure('public.portal_responder_por_token(uuid,text,text)'),to_regprocedure('public.portal_responder_proforma(uuid,text,text)'),to_regprocedure('public.portal_obtener_proforma_por_token(uuid)'),to_regprocedure('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)'),to_regprocedure('public.consolidar_proformas(uuid,uuid,text,text,text,text,integer,uuid,uuid[],numeric,uuid)'),to_regprocedure('public.enforce_proforma_aceptada_before_factura()'),to_regprocedure('public.tg_facturas_link_proforma()'));
-- Portal historical hash e227680fb6411452fd5cb9e76569271e is the exact
-- 20260901001100_fix4_n2_portal_proforma_dual.sql body (before three IVA keys).
DO $preconditions$
BEGIN
  IF EXISTS (SELECT 1 FROM (VALUES
    ('public.actualizar_estado_cliente_proforma(uuid,text,text)',ARRAY['f3ffae55644ff82b5fcc01a17e4e983c']::text[]),
    ('public.aceptar_proforma_sin_autorizacion(uuid)',ARRAY['0cf68ea6af69a06fbf48862c8c10cd97','41acd4ab7f44c12583ccc839c4adaa59']::text[]),
    ('public.portal_responder_por_token(uuid,text,text)',ARRAY['dcb1be5d4200ba1b04a60f872fc87903']::text[]),
    ('public.portal_responder_proforma(uuid,text,text)',ARRAY['63c6115450141e0b35484e15be9cc16c','af29cbfafaa52091226eda48093bbe67']::text[]),
    ('public.portal_obtener_proforma_por_token(uuid)',ARRAY['25ba9161d88024aa5f2fd264e23fbead','f482966df0eea4e2fb76c7ca7556d309','e227680fb6411452fd5cb9e76569271e']::text[]),
    ('public.convertir_proformas_a_factura(uuid[],uuid,text,text,text,integer,text,uuid)',ARRAY['2a214d577eb545ce47d9719ef6f5cdae','7115fa88a7e0a120d27a4a472e535236','aa69f15ed4144558b9e65056befd6707']::text[]),
    ('public.consolidar_proformas(uuid,uuid,text,text,text,text,integer,uuid,uuid[],numeric,uuid)',ARRAY['be1be413cfa975274adf55957f70834c']::text[]),
    ('public.enforce_proforma_aceptada_before_factura()',ARRAY['0b957944151354e2d1eb67467f3882b0']::text[]),
    ('public.tg_facturas_link_proforma()',ARRAY['d6f893a7a91a3005e3780b98a5ce6d98']::text[])
  ) expected(signature, hashes)
  LEFT JOIN pg_proc p ON p.oid=to_regprocedure(expected.signature)
  WHERE p.oid IS NULL OR NOT (md5(p.prosrc)=ANY(expected.hashes))) THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_PRECONDITION: definición distinta de la fuente revisada';
  END IF;
END $preconditions$;

CREATE OR REPLACE FUNCTION public.actualizar_estado_cliente_proforma(p_proforma_id uuid, p_respuesta text, p_motivo text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proforma      public.proformas%ROWTYPE;
  v_user_email    text;
  v_now           timestamptz := now();
  v_motivo        text;
  v_is_authorized boolean;
  v_bypass_prev text;
  v_liberados     integer := 0;
BEGIN
  IF p_respuesta NOT IN ('aceptada','rechazada','pendiente') THEN
    RAISE EXCEPTION 'Respuesta inválida.';
  END IF;
  SELECT * INTO v_proforma FROM public.proformas WHERE id = p_proforma_id FOR UPDATE;
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
  IF v_proforma.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para continuar' USING ERRCODE='P0001';
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
    -- Respuesta validada del cliente: liberar vínculos derivados no abre
    -- la edición del embarque cerrado ni deja una excepción para la llamada siguiente.
    v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
    BEGIN
      PERFORM set_config('app.bypass_cierre', 'on', true);
      v_liberados := public.liberar_conceptos_de_proforma(p_proforma_id);
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
      RAISE;
    END;
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
$$;

CREATE OR REPLACE FUNCTION public.aceptar_proforma_sin_autorizacion(p_proforma_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_p public.proformas%ROWTYPE;
  v_email text;
BEGIN
  SELECT * INTO v_p FROM public.proformas WHERE id = p_proforma_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PROFORMA_NO_ENCONTRADA: la proforma no existe' USING ERRCODE='P0002';
  END IF;
  IF v_p.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: la proforma fue eliminada' USING ERRCODE='P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM organization_members WHERE organization_id=v_p.organization_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: no perteneces a la organización de esta proforma' USING ERRCODE='42501';
  END IF;
  IF v_p.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para continuar' USING ERRCODE='P0001';
  END IF;
  IF public.cliente_requiere_autorizacion(v_p.cliente_id, 'proforma') THEN
    RAISE EXCEPTION 'LC_PROFORMA_REQUIERE_AUTORIZACION: este cliente sí requiere autorización de proformas' USING ERRCODE='P0001';
  END IF;
  IF COALESCE(v_p.estado_cliente,'pendiente') = 'aceptada' THEN
    RETURN jsonb_build_object('proforma_id', p_proforma_id, 'estado_cliente', 'aceptada', 'sin_cambios', true);
  END IF;
  UPDATE public.proformas
     SET estado_cliente = 'aceptada',
         aceptada_at = now(),
         aceptada_por = 'auto:sin_autorizacion_requerida',
         rechazada_at = NULL,
         updated_at = now()
   WHERE id = p_proforma_id;
  v_email := COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), '');
  INSERT INTO bitacora_actividad (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
  VALUES (v_p.organization_id, auth.uid(), v_email,
    'proforma.aceptada_sin_autorizacion','proformas',
    p_proforma_id, COALESCE(v_p.numero,''),
    jsonb_build_object('estado_cliente_previo', COALESCE(v_p.estado_cliente,'pendiente'),
                       'origen_aceptacion','auto_cliente_de_casa'));
  RETURN jsonb_build_object('proforma_id', p_proforma_id, 'estado_cliente', 'aceptada', 'sin_cambios', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_responder_por_token(p_token uuid, p_respuesta text, p_motivo text DEFAULT ''::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_proforma  public.proformas%ROWTYPE;
  v_now       timestamptz := now();
  v_motivo    text;
  v_titulo    text; v_mensaje text; v_tipo text;
  v_bypass_prev text;
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
  IF v_proforma.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: la proforma fue eliminada' USING ERRCODE='P0001';
  END IF;
  IF v_proforma.estado_proforma = 'cancelada' THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para continuar' USING ERRCODE='P0001';
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
    -- Respuesta validada del cliente: liberar vínculos derivados no abre
    -- la edición del embarque cerrado ni deja una excepción para la llamada siguiente.
    v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
    BEGIN
      PERFORM set_config('app.bypass_cierre', 'on', true);
      v_liberados := public.liberar_conceptos_de_proforma(v_proforma.id);
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
      RAISE;
    END;
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
END $$;

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

CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_conceptos jsonb;
  v_estado_link text;
  v_rl jsonb;
  v_moneda_legacy text;
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

  IF v_proforma.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('error','token_invalido');
  END IF;

  IF v_proforma.estado_proforma = 'cancelada' THEN
    v_estado_link := 'cancelada';
  ELSIF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    v_estado_link := 'expirado';
  ELSIF v_proforma.estado_cliente <> 'pendiente' THEN
    v_estado_link := 'respondida';
  ELSE
    v_estado_link := 'activo';
  END IF;

  -- BL-11: link no vigente → no exponer montos, conceptos ni datos del cliente.
  IF v_estado_link <> 'activo' THEN
    RETURN jsonb_build_object(
      'estado_link', v_estado_link,
      'proforma', jsonb_build_object(
        'id', v_proforma.id,
        'numero', v_proforma.numero
      ),
      'conceptos', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', pcc.id,
    'descripcion', pcc.descripcion,
    'cantidad', pcc.cantidad,
    'precio_unitario', pcc.precio_unitario,
    'importe', pcc.total,
    'moneda', pcc.moneda,
    'tipo_iva', pcc.tipo_iva,
    'tasa_iva_aplicada', pcc.tasa_iva_aplicada,
    'aplica_iva', pcc.aplica_iva
  ) ORDER BY pcc.created_at), '[]'::jsonb)
    INTO v_conceptos
    FROM public.proforma_conceptos_consolidados pcc
   WHERE pcc.proforma_id = v_proforma.id;

  -- FIX4 N-2: las columnas singulares ya no existen (multimoneda dual). Las
  -- claves legacy se derivan: MXN si hay subtotal_mxn o si ambos son cero
  -- (default histórico); si no, USD. El front nuevo usa los juegos duales.
  v_moneda_legacy := CASE
    WHEN v_proforma.subtotal_mxn > 0
      OR (v_proforma.subtotal_mxn = 0 AND v_proforma.subtotal_usd = 0)
    THEN 'MXN'
    ELSE 'USD'
  END;

  RETURN jsonb_build_object(
    'estado_link', v_estado_link,
    'proforma', jsonb_build_object(
      'id', v_proforma.id,
      'numero', v_proforma.numero,
      'cliente_nombre', v_proforma.cliente_nombre,
      'expediente', v_proforma.expediente,
      -- Juegos duales (fuente de verdad multimoneda)
      'subtotal_mxn', v_proforma.subtotal_mxn,
      'iva_mxn', v_proforma.iva_mxn,
      'total_mxn', v_proforma.total_mxn,
      'subtotal_usd', v_proforma.subtotal_usd,
      'iva_usd', v_proforma.iva_usd,
      'total_usd', v_proforma.total_usd,
      -- Claves legacy singulares derivadas (compat con el front publicado)
      'moneda', v_moneda_legacy,
      'subtotal', CASE WHEN v_moneda_legacy = 'MXN' THEN v_proforma.subtotal_mxn ELSE v_proforma.subtotal_usd END,
      'iva', CASE WHEN v_moneda_legacy = 'MXN' THEN v_proforma.iva_mxn ELSE v_proforma.iva_usd END,
      'total', CASE WHEN v_moneda_legacy = 'MXN' THEN v_proforma.total_mxn ELSE v_proforma.total_usd END,
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

CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(p_proforma_ids uuid[], p_serie_id uuid, p_metodo_pago text, p_forma_pago text, p_uso_cfdi text, p_dias_credito integer DEFAULT NULL::integer, p_notas text DEFAULT NULL::text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF facturas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb; v_count int; v_first public.proformas;
  v_org uuid; v_caller_org uuid; v_cliente public.clientes;
  v_serie public.factura_series;
  v_subtotal_usd numeric := 0; v_iva_usd numeric := 0; v_total_usd numeric := 0;
  v_subtotal_mxn numeric := 0; v_iva_mxn numeric := 0; v_total_mxn numeric := 0;
  v_distinct_cli int; v_distinct_org int; v_distinct_tipo int; v_distinct_dias int;
  v_factura_ids uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid; v_factura_usd_id uuid;
  v_numero_tmp text; v_embarque_ids uuid[];
  v_dias int;
  -- R170-02: fecha de negocio en hora México, no CURRENT_DATE (UTC).
  v_hoy_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL AND (v_cached ? 'factura_ids') THEN
    RETURN QUERY SELECT * FROM public.facturas
      WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_cached->'factura_ids'))::uuid[])
        AND deleted_at IS NULL;
    RETURN;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  PERFORM public.convertir_proformas_a_factura_check_embarque_vivo(p_proforma_ids);

  v_caller_org := public.current_user_org_id();

  IF NOT (
    public.es_escritor_financiero(auth.uid())
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_SIN_PERMISO: rol no autorizado para convertir proformas' USING ERRCODE='P0001';
  END IF;

  PERFORM 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL FOR UPDATE;

  SELECT count(*), count(DISTINCT organization_id), count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  SELECT * INTO v_first FROM public.proformas
    WHERE id = ANY(p_proforma_ids) ORDER BY created_at ASC LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org IS DISTINCT FROM v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  IF EXISTS (SELECT 1 FROM public.proformas WHERE id = ANY(p_proforma_ids) AND estado_proforma = 'cancelada') THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: crea una nueva proforma para refacturar' USING ERRCODE='P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND estado_proforma = 'facturada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_YA_FACTURADA: una o más proformas ya fueron facturadas' USING ERRCODE='P0002';
  END IF;

  -- v13.823.279 — Candado de aceptación: la UI ya oculta la acción para
  -- proformas pendientes o rechazadas, pero la RPC podía llamarse directo y
  -- facturar sin la respuesta del cliente. Para clientes de casa, la RPC
  -- `aceptar_proforma_sin_autorizacion` deja `estado_cliente = 'aceptada'`,
  -- así que ese flujo sigue funcionando igual.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND deleted_at IS NULL
      AND coalesce(estado_cliente, 'pendiente') <> 'aceptada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_REQUIERE_ACEPTACION: una o más proformas no están aceptadas por el cliente (pendiente o rechazada)' USING ERRCODE='P0002';
  END IF;

  -- C25 (v13.823.380) — Una proforma FUENTE ya consolidada repuntó sus
  -- conceptos a la proforma consolidada: facturarla emitiría una factura sin
  -- líneas y la marcaría facturada.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL
      AND estado_revision = 'consolidada'
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_FUENTE_CONSOLIDADA: una o más proformas ya fueron consolidadas; factura la proforma consolidada, no sus fuentes' USING ERRCODE='P0002';
  END IF;

  -- C25 — La rama de conceptos (consolidados vs conceptos_venta) se elegía con
  -- `v_first.es_consolidada` para TODO el lote: mezclar tipos podía omitir
  -- líneas y marcar todas las proformas como facturadas.
  SELECT count(DISTINCT es_consolidada) INTO v_distinct_tipo
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  IF COALESCE(v_distinct_tipo, 1) > 1 THEN
    RAISE EXCEPTION 'LC_PROFORMA_MEZCLA_CONSOLIDADA: no puedes fusionar proformas consolidadas con proformas individuales; convierte cada tipo por separado' USING ERRCODE='P0001';
  END IF;

  -- C25 — Condiciones de pago: sin plazo explícito, una fusión con plazos
  -- distintos elegía en silencio el de la proforma más antigua.
  IF array_length(p_proforma_ids, 1) > 1 AND COALESCE(NULLIF(p_dias_credito, 0), NULL) IS NULL THEN
    SELECT count(DISTINCT COALESCE(dias_credito, -1)) INTO v_distinct_dias
    FROM public.proformas
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;
    IF COALESCE(v_distinct_dias, 1) > 1 THEN
      RAISE EXCEPTION 'LC_PROFORMA_DIAS_CREDITO_DISTINTOS: las proformas tienen plazos de crédito distintos; iguala el plazo o indica el plazo de la factura' USING ERRCODE='P0001';
    END IF;
  END IF;



  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

  -- Cascada de plazo de crédito: parámetro → proforma → ficha del cliente → 0.
  v_dias := COALESCE(NULLIF(p_dias_credito, 0), v_first.dias_credito, v_cliente.dias_credito, p_dias_credito, 0);


  SELECT array_agg(DISTINCT embarque_id) INTO v_embarque_ids
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND embarque_id IS NOT NULL;

  IF v_first.es_consolidada THEN
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN total ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN total ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.proforma_conceptos_consolidados
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.conceptos_venta
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  IF v_subtotal_mxn > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'MXN'::public.moneda, 1,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_mxn_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_mxn_id, p_proforma_ids, v_org, v_first.es_consolidada, 'MXN'::public.moneda
    );

    -- BUG-17: recalcular desde el `total` guardado del renglón (pcc.total en
    -- consolidadas), no desde cantidad*precio_unitario que puede diverger.
    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_mxn, v_iva_mxn
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_mxn_id AND deleted_at IS NULL;
    v_subtotal_mxn := round(v_subtotal_mxn, 2);
    v_iva_mxn := round(v_iva_mxn, 2);
    v_total_mxn := v_subtotal_mxn + v_iva_mxn;

    UPDATE public.facturas
    SET subtotal = v_subtotal_mxn, iva = v_iva_mxn, total = v_total_mxn
    WHERE id = v_factura_mxn_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_mxn_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF v_subtotal_usd > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      0, 0, 0, 'USD'::public.moneda, NULL,
      v_hoy_mx,
      v_hoy_mx + make_interval(days => v_dias),
      'Borrador'::estado_factura, v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, v_dias,
      p_notas, 'conversion_proforma'
    ) RETURNING id INTO v_factura_usd_id;

    PERFORM public._convertir_proformas_insertar_conceptos(
      v_factura_usd_id, p_proforma_ids, v_org, v_first.es_consolidada, 'USD'::public.moneda
    );

    -- BUG-17: recalcular desde el `total` guardado del renglón (pcc.total en
    -- consolidadas), no desde cantidad*precio_unitario que puede diverger.
    SELECT
      COALESCE(SUM(total), 0),
      COALESCE(SUM(total * COALESCE(tasa_iva_aplicada, 0)), 0)
    INTO v_subtotal_usd, v_iva_usd
    FROM public.conceptos_factura
    WHERE factura_id = v_factura_usd_id AND deleted_at IS NULL;
    v_subtotal_usd := round(v_subtotal_usd, 2);
    v_iva_usd := round(v_iva_usd, 2);
    v_total_usd := v_subtotal_usd + v_iva_usd;

    UPDATE public.facturas
    SET subtotal = v_subtotal_usd, iva = v_iva_usd, total = v_total_usd
    WHERE id = v_factura_usd_id;

    IF v_embarque_ids IS NOT NULL THEN
      INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id)
      SELECT v_factura_usd_id, unnest(v_embarque_ids), v_org
      ON CONFLICT DO NOTHING;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    ) VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'embarque_ids', to_jsonb(v_embarque_ids),
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF array_length(v_factura_ids, 1) > 0 THEN
    -- C30 (v13.823.381): en una fusión de VARIAS proformas las facturas nacen
    -- con `proforma_id = NULL` (una factura, N proformas), así que cada fuente
    -- perdía el enlace al PDF/folio. Se enlaza desde la proforma:
    --   factura_id            → borrador principal (MXN si existe, si no el USD)
    --   factura_secundaria_id → segundo borrador cuando hay MXN + USD
    -- El flujo de una sola proforma no cambia: apunta a la(s) misma(s) factura(s).
    UPDATE public.proformas
    SET estado_proforma = 'facturada',
        fecha_facturacion = v_hoy_mx,
        factura_id = COALESCE(v_factura_mxn_id, v_factura_usd_id),
        factura_secundaria_id = CASE
          WHEN v_factura_mxn_id IS NOT NULL AND v_factura_usd_id IS NOT NULL THEN v_factura_usd_id
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  IF p_request_id IS NOT NULL THEN
    PERFORM public.idempotency_store(p_request_id, jsonb_build_object('factura_ids', to_jsonb(v_factura_ids)));
  END IF;

  RETURN QUERY SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid) RETURNS public.proformas
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_bypass_prev text;
  v_nueva          public.proformas;
  v_cached         jsonb;
  v_caller_org     uuid;
  v_org_efectiva   uuid;
  v_count          int;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_no_soportados  int;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_nueva; END IF;
  END IF;
  v_caller_org := public.current_user_org_id();
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org_efectiva := p_organization_id;
  ELSE
    v_org_efectiva := v_caller_org;
  END IF;
  PERFORM public._assert_writer(v_org_efectiva);
  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;
  PERFORM 1 FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva FOR UPDATE;
  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proformas WHERE id = ANY(p_proforma_ids) AND estado_proforma = 'cancelada') THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede consolidar una proforma cancelada' USING ERRCODE='P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.proformas WHERE id = ANY(p_proforma_ids) AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'LC_PROFORMA_ELIMINADA: no se puede consolidar una proforma eliminada' USING ERRCODE='P0001';
  END IF;
  -- Ola 3: la consolidación no puede cruzar embarques.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND embarque_id IS DISTINCT FROM p_embarque_id
  ) THEN
    RAISE EXCEPTION
      'LC_PROFORMA_EMBARQUE_AJENO: todas las proformas a consolidar deben pertenecer al mismo embarque'
      USING ERRCODE = 'P0001';
  END IF;
  -- Ola 2 · A: guard equivalente al de crear_proforma_atomica sobre los
  -- conceptos subyacentes (una moneda no soportada consolidaba en $0).
  SELECT COUNT(*) INTO v_no_soportados
  FROM public.conceptos_venta cv
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.deleted_at IS NULL
    AND cv.moneda NOT IN ('MXN', 'USD');
  IF v_no_soportados > 0 THEN
    RAISE EXCEPTION 'LC_MONEDA_VENTA_NO_SOPORTADA: % concepto(s) de venta tienen una moneda no soportada; sólo se puede facturar en MXN o USD', v_no_soportados
      USING ERRCODE = 'P0001';
  END IF;
  v_numero := public.generar_numero_proforma(v_org_efectiva);
  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    0, 0, 0, 0, 0, 0,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, v_org_efectiva,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;
  -- A-1: cantidad SIN ::int (BL-1 permite decimales); IVA por LÍNEA con la tasa
  -- propia de cada concepto y redondeo por línea (BL-12). La tasa efectiva y el
  -- tratamiento fiscal explícito entran al GROUP BY: 'no_objeto', 'exento' y
  -- 'tasa_0' quedan en líneas distintas aunque su IVA sea 0.
  -- P1 · Auditoría IVA: la tasa es CANÓNICA por tratamiento; una tasa numérica
  -- faltante NUNCA se rellena con la tasa general si el tipo dice otra cosa.
  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada, tipo_iva
  )
  SELECT
    v_nueva.id, cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad), cv.precio_unitario,
    ROUND(SUM(cv.cantidad * cv.precio_unitario), 2), cv.moneda,
    CASE WHEN cv.tipo_iva IN ('no_objeto', 'exento') THEN false ELSE cv.aplica_iva END,
    ROUND(SUM(cv.cantidad * cv.precio_unitario) * CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END, 2),
    v_org_efectiva,
    CASE WHEN cv.tipo_iva = 'no_objeto' THEN NULL
         ELSE CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END
    END,
    cv.tipo_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.embarque_id = p_embarque_id
    AND cv.deleted_at IS NULL
  GROUP BY cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva, cv.tipo_iva,
    CASE
            WHEN cv.tipo_iva = 'gravado_16' THEN p_tasa_iva
            WHEN cv.tipo_iva = 'gravado_8'  THEN 0.08
            WHEN cv.tipo_iva IN ('tasa_0', 'exento', 'no_objeto') THEN 0
            ELSE COALESCE(cv.tasa_iva_aplicada, CASE WHEN cv.aplica_iva THEN p_tasa_iva ELSE 0 END)
          END;
  -- Encabezado = Σ del detalle recién generado.
  SELECT
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'USD'), 0),
    COALESCE(SUM(pcc.total) FILTER (WHERE pcc.moneda = 'MXN'), 0),
    COALESCE(SUM(pcc.iva)   FILTER (WHERE pcc.moneda = 'MXN'), 0)
  INTO v_subtotal_usd, v_iva_usd, v_subtotal_mxn, v_iva_mxn
  FROM public.proforma_conceptos_consolidados pcc
  WHERE pcc.proforma_id = v_nueva.id;
  v_total_usd := v_subtotal_usd + v_iva_usd;
  v_total_mxn := v_subtotal_mxn + v_iva_mxn;
  UPDATE public.proformas
  SET subtotal_usd = v_subtotal_usd, iva_usd = v_iva_usd, total_usd = v_total_usd,
      subtotal_mxn = v_subtotal_mxn, iva_mxn = v_iva_mxn, total_mxn = v_total_mxn
  WHERE id = v_nueva.id
  RETURNING * INTO v_nueva;
  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);
  -- v13.301.69 FIX BUG 2: repuntar conceptos_venta a la proforma consolidada
  -- para que sync_conceptos_venta_facturado propague al facturar/cancelar.
  v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), '');
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);
    UPDATE public.conceptos_venta
       SET proforma_id = v_nueva.id
     WHERE proforma_id = ANY(p_proforma_ids)
       AND organization_id = v_org_efectiva
       AND deleted_at IS NULL;
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$_$;

CREATE OR REPLACE FUNCTION public.enforce_proforma_aceptada_before_factura() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Terminal sólo para acciones; conserva notas, papelera e histórico.
  IF OLD.estado_proforma = 'cancelada' AND (
      NEW.estado_proforma IS DISTINCT FROM OLD.estado_proforma
      OR NEW.estado_cliente IS DISTINCT FROM OLD.estado_cliente
      OR NEW.estado_revision IS DISTINCT FROM OLD.estado_revision
      OR NEW.estado_aprobacion IS DISTINCT FROM OLD.estado_aprobacion
      OR NEW.factura_id IS DISTINCT FROM OLD.factura_id
      OR NEW.factura_secundaria_id IS DISTINCT FROM OLD.factura_secundaria_id
      OR NEW.folio_factura_externa IS DISTINCT FROM OLD.folio_factura_externa
      OR NEW.fecha_facturacion IS DISTINCT FROM OLD.fecha_facturacion
      OR NEW.aceptada_at IS DISTINCT FROM OLD.aceptada_at
      OR NEW.rechazada_at IS DISTINCT FROM OLD.rechazada_at
      OR NEW.aceptada_por IS DISTINCT FROM OLD.aceptada_por
      OR NEW.motivo_rechazo IS DISTINCT FROM OLD.motivo_rechazo
      OR NEW.token_publico IS DISTINCT FROM OLD.token_publico
      OR NEW.token_expira_at IS DISTINCT FROM OLD.token_expira_at
      OR NEW.enviada_at IS DISTINCT FROM OLD.enviada_at
      OR NEW.enviada_por IS DISTINCT FROM OLD.enviada_por
      OR NEW.ultimo_envio_email IS DISTINCT FROM OLD.ultimo_envio_email
      OR NEW.consolidada_en IS DISTINCT FROM OLD.consolidada_en
  ) THEN
    RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede reactivar el histórico cancelado' USING ERRCODE='P0001';
  END IF;
  IF (OLD.factura_id IS NULL AND NEW.factura_id IS NOT NULL)
     OR (COALESCE(OLD.estado_proforma,'') <> 'facturada' AND NEW.estado_proforma = 'facturada') THEN
    IF COALESCE(NEW.estado_cliente,'pendiente') <> 'aceptada' THEN
      RAISE EXCEPTION 'La proforma % no puede facturarse: el cliente no la ha aceptado (estado actual: %).',
        NEW.numero, COALESCE(NEW.estado_cliente,'pendiente');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_facturas_link_proforma() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_estado_proforma text;
BEGIN
  IF NEW.proforma_id IS NOT NULL AND NEW.deleted_at IS NULL
     AND NEW.estado NOT IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura) THEN
    -- Lock de proforma: mismo orden lógico que cancelar/convertir.
    SELECT estado_proforma INTO v_estado_proforma FROM public.proformas
    WHERE id = NEW.proforma_id AND organization_id = NEW.organization_id FOR UPDATE;
    IF v_estado_proforma = 'cancelada' THEN
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede facturar una proforma cancelada' USING ERRCODE='P0001';
      ELSIF NEW.proforma_id IS DISTINCT FROM OLD.proforma_id
         OR OLD.deleted_at IS NOT NULL
         OR OLD.estado IN ('Cancelada'::estado_factura,'Sustituida'::estado_factura) THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede reactivar la factura de una proforma cancelada' USING ERRCODE='P0001';
      END IF;
      IF OLD.estado IN ('Borrador'::estado_factura,'Por timbrar'::estado_factura)
         AND NEW.estado IS DISTINCT FROM OLD.estado THEN
        RAISE EXCEPTION 'LC_PROFORMA_CANCELADA: no se puede emitir un borrador del histórico cancelado' USING ERRCODE='P0001';
      END IF;
      -- Facturas históricas existentes conservan su vínculo sin reactivar proforma.
      RETURN NEW;
    END IF;
    UPDATE public.proformas
       SET factura_id = NEW.id
     WHERE id = NEW.proforma_id
       AND (factura_id IS NULL OR factura_id <> NEW.id)
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END $$;

DO $metadata$
BEGIN
  IF EXISTS (
    SELECT 1 FROM proforma_cancelada_metadata b LEFT JOIN pg_proc p ON p.oid=b.oid
    WHERE p.oid IS NULL OR p.proowner IS DISTINCT FROM b.proowner
      OR p.proacl IS DISTINCT FROM b.proacl OR p.prosecdef IS DISTINCT FROM b.prosecdef
      OR p.proconfig IS DISTINCT FROM b.proconfig OR p.prorettype IS DISTINCT FROM b.prorettype
      OR p.proargtypes IS DISTINCT FROM b.proargtypes
  ) THEN
    RAISE EXCEPTION 'PROFORMA_CANCELADA_METADATA: se alteraron owner, ACL, security o firma';
  END IF;
END $metadata$;
COMMIT;
