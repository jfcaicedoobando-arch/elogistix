DROP POLICY IF EXISTS "Cliente read own cotizaciones" ON public.cotizaciones;
CREATE POLICY "Cliente read own cotizaciones" ON public.cotizaciones
FOR SELECT TO authenticated
USING (
  has_role((SELECT auth.uid()), 'cliente'::app_role)
  AND (cliente_id IN (SELECT current_user_client_ids()))
  AND (estado = ANY (ARRAY[
    'Solicitada'::estado_cotizacion,
    'Enviada'::estado_cotizacion,
    'Aceptada'::estado_cotizacion,
    'Rechazada'::estado_cotizacion,
    'En operación'::estado_cotizacion
  ]))
);

CREATE OR REPLACE FUNCTION public.portal_solicitar_cotizacion(p_cliente_id uuid, p_modo modo_transporte, p_tipo tipo_operacion, p_origen text, p_destino text, p_tipo_embarque text DEFAULT 'FCL'::text, p_tipo_contenedor text DEFAULT NULL::text, p_descripcion_mercancia text DEFAULT ''::text, p_notas text DEFAULT NULL::text)
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

  IF coalesce(btrim(p_origen), '') = '' OR coalesce(btrim(p_destino), '') = '' THEN
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
    descripcion_mercancia, estado, notas
  ) VALUES (
    v_org, v_folio, p_cliente_id, coalesce(v_cliente_nombre, ''), p_modo, p_tipo,
    btrim(p_origen), btrim(p_destino), coalesce(nullif(btrim(p_tipo_embarque), ''), 'FCL'),
    nullif(btrim(coalesce(p_tipo_contenedor, '')), ''),
    coalesce(p_descripcion_mercancia, ''), 'Solicitada',
    '[Solicitud desde portal del cliente]' ||
      CASE WHEN coalesce(btrim(p_notas), '') = '' THEN '' ELSE E'\n' || btrim(p_notas) END
  )
  RETURNING cotizaciones.id INTO v_id;

  RETURN QUERY SELECT v_id, v_folio;
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text) TO authenticated;