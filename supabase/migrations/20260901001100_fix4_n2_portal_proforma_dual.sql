-- ============================================================================
-- FIX4 tanda 4 · N-2 / N-2b · Portal público de proformas (500 en link activo)
--
-- N-2 · portal_obtener_proforma_por_token (bug real, reproducido en vivo):
--   el cuerpo referencia v_proforma.moneda / subtotal / iva / total, pero la
--   tabla public.proformas ya no tiene esas columnas — son duales
--   (subtotal_mxn/subtotal_usd, iva_mxn/iva_usd, total_mxn/total_usd) desde la
--   multimoneda. Cualquier consulta con link ACTIVO aborta con 42703
--   (column does not exist) → el portal devuelve 500 justo cuando el cliente
--   sí puede ver su proforma. (El branch BL-11 de link no vigente no toca los
--   montos y por eso nunca tronó.)
--
--   Fix: la RPC devuelve los DOS juegos duales (subtotal_mxn/iva_mxn/
--   total_mxn y subtotal_usd/iva_usd/total_usd) y conserva las claves legacy
--   singulares (moneda/subtotal/iva/total) derivadas para no romper el front
--   publicado:
--     · MXN si subtotal_mxn > 0, o si ambos subtotales son 0 (default MXN);
--     · si no, USD.
--   Espejo canónico supabase/schema/portal/ sincronizado.
--
-- N-2b · portal_responder_por_token (mismo flujo, también 500): el INSERT en
--   bitacora_actividad del actor anónimo manda usuario_id = NULL y la columna
--   era NOT NULL → 23502 al aceptar/rechazar desde el portal. La bitácora ya
--   contempla actores sin sesión (usuario_email), así que la columna queda
--   nullable.
-- ============================================================================

-- ------------------------------------------------------------------ N-2
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

  IF v_proforma.token_expira_at IS NOT NULL AND v_proforma.token_expira_at < now() THEN
    v_estado_link := 'expirado';
  ELSIF v_proforma.estado_cliente <> 'pendiente' THEN
    v_estado_link := 'respondida';
  ELSE
    v_estado_link := 'activo';
  END IF;

  -- BL-11 (migración 20260817142000): link no vigente → no exponer montos,
  -- conceptos ni datos del cliente; sólo el estado y el número.
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

REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated;

-- ------------------------------------------------------------------ N-2b
-- Actor anónimo del portal: la bitácora admite usuario_id NULL (el correo se
-- conserva en usuario_email, que ya era la pista de auditoría del actor).
ALTER TABLE public.bitacora_actividad ALTER COLUMN usuario_id DROP NOT NULL;
