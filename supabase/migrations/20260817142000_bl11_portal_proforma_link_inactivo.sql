-- ============================================================
-- BL-11: el portal público (`portal_obtener_proforma_por_token`) calculaba
-- `v_estado_link` ('expirado'/'respondida') pero devolvía SIEMPRE la proforma
-- completa (subtotal/iva/total, cliente, expediente) y todos los conceptos.
-- Cualquiera con el UUID del link (correos reenviados, logs, historial)
-- podía leer los datos financieros después de expirado el plazo o de que el
-- cliente ya respondió. Ahora, cuando el link no está 'activo', se devuelve
-- sólo `estado_link` + el número de la proforma (dato mínimo para que la UI
-- muestre el estado), sin montos, conceptos ni datos del cliente.
-- Sin cambio de firma ni de grants. ACUMULATIVA sobre la versión canónica
-- (supabase/schema/portal/portal_obtener_proforma_por_token.sql).
-- ============================================================

CREATE OR REPLACE FUNCTION public.portal_obtener_proforma_por_token(p_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proforma public.proformas%ROWTYPE;
  v_conceptos jsonb;
  v_estado_link text;
BEGIN
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

-- Grants vigentes (20260702150453): reafirmados tras recrear la función.
REVOKE ALL ON FUNCTION public.portal_obtener_proforma_por_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_obtener_proforma_por_token(uuid) TO anon, authenticated;
