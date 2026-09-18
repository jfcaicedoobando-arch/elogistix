-- Canonical schema para public.portal_obtener_proforma_por_token
-- Sincronizado en FIX4 tanda 4 (N-2 · multimoneda dual).
--
-- Historial de fixes:
--   · antes se exponía una columna inexistente (`importe`) de la vista
--     `proforma_conceptos_consolidados`, que publica `total`. Se conserva el
--     nombre `importe` como clave de salida en el JSON del portal público
--     para no romper el contrato con el front.
--   · FIX3 (drift ronda 2): rate limit de BD restaurado (30 lecturas/min por
--     IP+identidad), mismo patrón que las demás RPCs de la whitelist anon.
--     check_ratelimit escribe en ratelimit_buckets → la función debe ser
--     VOLATILE.
--   · FIX4 N-2: la tabla proformas ya no tiene moneda/subtotal/iva/total
--     singulares (son *_mxn / *_usd). La RPC devuelve ambos juegos duales y
--     conserva las claves legacy singulares derivadas (MXN si
--     subtotal_mxn > 0 o ambos cero; si no, USD) para no romper el contrato
--     del front publicado.
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

REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated;
