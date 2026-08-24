-- ============================================================================
-- fix3 (tanda 3) — rate limits y grants de las RPCs ejecutables por `anon`.
--
-- Auditoría (bugs2/public_surface_hunter.md, P2/P3): las RPCs con GRANT anon
-- son invocables directo por PostgREST saltándose la edge function. Estado
-- verificado en HEAD (5e6fdd2):
--
--   RPC (anon, SECURITY DEFINER)        check_ratelimit  Decisión
--   ----------------------------------  ---------------  ---------------------------
--   portal_obtener_proforma_por_token   sí (30/min)      Ya lo tiene y ya es VOLATILE
--                                                        en la base actual; se
--                                                        re-emite idéntica (idempotente)
--                                                        para fijar el contrato.
--   portal_responder_por_token          sí (10/min)      Sin cambio de grant.
--   get_tracking_public                 sí (60/min)      Sin cambio.
--   log_client_error_v1                 sí (20/min)      Sin cambio.
--   check_ratelimit                     es el mecanismo  Mantiene anon (la edge lo
--                                                        invoca con ANON_KEY).
--   handle_new_user_signup              n/a              REVOKE: es función trigger
--                                                        de auth.users; los triggers
--                                                        corren como owner y no
--                                                        necesitan EXECUTE. Nadie la
--                                                        llama directo (verificado).
--   is_demo_user                        n/a              Mantiene whitelist: STABLE,
--                                                        devuelve booleano y el front
--                                                        degrada a false ante error.
--   current_user_org_id / has_role /    n/a              Mantienen whitelist (helpers
--   has_any_role / current_agente_id /                   de RLS NULL-safe, documentado
--   current_agente_org                                   en fix45).
--   portal_solicitar_cotizacion         añadido en       NO es anon (authenticated);
--                                       20260831200300   grant sin cambio.
--
-- El espejo canónico supabase/schema/portal/portal_obtener_proforma_por_token.sql
-- se sincroniza en el mismo commit. fix45_anon_execute_whitelist.sql ahora
-- además exige que las 4 RPCs públicas contengan check_ratelimit.
-- ============================================================================

-- 1) portal_obtener_proforma_por_token — re-emisión con rate limit (30/min).
--    Cuerpo idéntico al vigente (20260817155946, BL-11) salvo el bloque v_rl
--    y el atributo VOLATILE (check_ratelimit escribe en ratelimit_buckets).
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

REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated, service_role;

-- 2) handle_new_user_signup — función trigger de auth.users; nadie la invoca
--    directo y los triggers no requieren EXECUTE. Se cierra la superficie.
REVOKE ALL ON FUNCTION public.handle_new_user_signup() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;
