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
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT v.id, v.folio
  FROM public.portal_solicitar_cotizacion_v2(
    p_cliente_id, p_modo, p_tipo, p_origen, p_destino,
    p_tipo_embarque, p_tipo_contenedor, p_descripcion_mercancia, p_notas,
    NULL::uuid, NULL::uuid
  ) AS v;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO service_role;