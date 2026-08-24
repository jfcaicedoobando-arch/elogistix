-- >>> 20260831200100_fix3_portal_rls_eventos_notas
-- ============================================================================
-- fix3 (tanda 3, superficie pública) — RLS de eventos/notas del portal.
-- Cliente/agente sólo ven hitos de negocio y cambios de estado, sin marcas
-- internas/semilla/E2E ni borrados lógicos.
-- ============================================================================

DROP POLICY IF EXISTS "Cliente read own eventos" ON public.eventos_embarque;
CREATE POLICY "Cliente read own eventos" ON public.eventos_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
  AND tipo::text IN (
    'Zarpe', 'Transbordo', 'Arribo a Puerto', 'Descarga',
    'Despacho Aduanal', 'Liberación', 'En Ruta Terrestre', 'Entrega',
    'Cambio de ETA'
  )
  AND deleted_at IS NULL
  AND lower(COALESCE(descripcion, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
  AND lower(COALESCE(usuario, ''))     NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
);

DROP POLICY IF EXISTS "Cliente read own notas" ON public.notas_embarque;
CREATE POLICY "Cliente read own notas" ON public.notas_embarque
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cliente'::app_role) AND
  tipo = 'cambio_estado'::tipo_nota AND
  deleted_at IS NULL AND
  lower(COALESCE(contenido, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%']) AND
  lower(COALESCE(usuario, ''))   NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%']) AND
  embarque_id IN (SELECT id FROM public.embarques WHERE cliente_id IN (SELECT current_user_client_ids()))
);

DROP POLICY IF EXISTS "Agente read own notas" ON public.notas_embarque;
CREATE POLICY "Agente read own notas"
  ON public.notas_embarque FOR SELECT
  USING (
    has_role(auth.uid(), 'agente_carga'::app_role)
    AND tipo = 'cambio_estado'::tipo_nota
    AND deleted_at IS NULL
    AND lower(COALESCE(contenido, '')) NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
    AND lower(COALESCE(usuario, ''))   NOT LIKE ALL (ARRAY['%[interno]%', '%harness%', '%e2e%', '%seed%', '%qa-%'])
    AND EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.id = notas_embarque.embarque_id
        AND e.organization_id = current_agente_org()
        AND e.agente_id IS NOT NULL
        AND e.agente_id = current_agente_id()
    )
  );

-- >>> 20260831200200_fix3_portal_responder_cas_y_motivo_cap
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

  -- fix3: FOR UPDATE serializa respuestas concurrentes del mismo token.
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

  -- fix3: motivo acotado a 1000 caracteres.
  v_motivo := NULLIF(LEFT(btrim(COALESCE(p_motivo, '')), 1000), '');
  IF p_respuesta = 'rechazada' AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Es obligatorio indicar el motivo de rechazo.';
  END IF;

  -- fix3: compare-and-set atómico.
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

  -- fix3: usuario sentinel — bitacora_actividad.usuario_id es NOT NULL.
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

REVOKE ALL ON FUNCTION public.portal_responder_por_token(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_responder_por_token(uuid, text, text) TO anon, authenticated, service_role;

-- >>> 20260831200300_fix3_portal_solicitar_cotizacion_ratelimit
CREATE OR REPLACE FUNCTION public.portal_solicitar_cotizacion(
  p_cliente_id uuid,
  p_modo modo_transporte,
  p_tipo tipo_operacion,
  p_origen text,
  p_destino text,
  p_tipo_embarque text DEFAULT 'FCL'::text,
  p_tipo_contenedor text DEFAULT NULL::text,
  p_descripcion_mercancia text DEFAULT ''::text,
  p_notas text DEFAULT NULL::text
)
RETURNS TABLE(id uuid, folio text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_cliente_nombre text;
  v_num bigint;
  v_anio text := to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY');
  v_folio text;
  v_id uuid;
  v_rl jsonb;
  v_origen text := LEFT(btrim(COALESCE(p_origen, '')), 200);
  v_destino text := LEFT(btrim(COALESCE(p_destino, '')), 200);
  v_descripcion text := LEFT(COALESCE(p_descripcion_mercancia, ''), 2000);
  v_notas text := NULLIF(LEFT(btrim(COALESCE(p_notas, '')), 2000), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO: sesión requerida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid() AND cu.cliente_id = p_cliente_id
  ) THEN
    RAISE EXCEPTION 'LC_CLIENTE_NO_VINCULADO: el usuario no pertenece a este cliente';
  END IF;

  v_rl := public.check_ratelimit(
    'rpc:portal_solicitar_cotizacion:' || p_cliente_id::text || ':' || auth.uid()::text,
    3600, 10
  );
  IF (v_rl->>'ok') = 'false' THEN
    RAISE EXCEPTION 'Demasiadas solicitudes. Intenta de nuevo en % segundos.', COALESCE(v_rl->>'retry_after', '60')
      USING ERRCODE = 'P0001';
  END IF;

  IF v_origen = '' OR v_destino = '' THEN
    RAISE EXCEPTION 'LC_RUTA_REQUERIDA: origen y destino son obligatorios';
  END IF;

  SELECT c.organization_id, c.nombre INTO v_org, v_cliente_nombre
  FROM public.clientes c WHERE c.id = p_cliente_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_NO_RESUELTA: no se pudo determinar la organización';
  END IF;

  INSERT INTO public.folio_secuencias (organization_id, tipo, ultimo_numero)
  VALUES (v_org, 'cotizacion_' || v_anio, 1)
  ON CONFLICT (organization_id, tipo)
  DO UPDATE SET ultimo_numero = folio_secuencias.ultimo_numero + 1,
                updated_at = now()
  RETURNING ultimo_numero INTO v_num;

  v_folio := 'COT-' || v_anio || '-' || lpad(v_num::text, 4, '0');

  INSERT INTO public.cotizaciones (
    organization_id, folio, cliente_id, cliente_nombre, modo, tipo,
    origen, destino, tipo_embarque, tipo_contenedor,
    descripcion_mercancia, estado, notas, origen_portal
  ) VALUES (
    v_org, v_folio, p_cliente_id, coalesce(v_cliente_nombre, ''), p_modo, p_tipo,
    v_origen, v_destino, coalesce(nullif(LEFT(btrim(COALESCE(p_tipo_embarque, '')), 50), ''), 'FCL'),
    nullif(LEFT(btrim(coalesce(p_tipo_contenedor, '')), 100), ''),
    v_descripcion, 'Solicitada',
    '[Solicitud desde portal del cliente]' ||
      CASE WHEN v_notas IS NULL THEN '' ELSE E'\n' || v_notas END,
    true
  )
  RETURNING cotizaciones.id INTO v_id;

  RETURN QUERY SELECT v_id, v_folio;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO service_role;

-- >>> 20260831200400_fix3_rpcs_anon_ratelimit_y_grants
-- handle_new_user_signup: función trigger de auth.users; los triggers corren
-- como owner y no requieren EXECUTE para anon/authenticated.
REVOKE ALL ON FUNCTION public.handle_new_user_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;