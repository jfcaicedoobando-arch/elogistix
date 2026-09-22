CREATE OR REPLACE FUNCTION public.portal_solicitar_cotizacion_v2(
  p_cliente_id uuid,
  p_modo modo_transporte,
  p_tipo tipo_operacion,
  p_origen text,
  p_destino text,
  p_tipo_embarque text DEFAULT 'FCL'::text,
  p_tipo_contenedor text DEFAULT NULL::text,
  p_descripcion_mercancia text DEFAULT ''::text,
  p_notas text DEFAULT NULL::text,
  p_puerto_origen_id uuid DEFAULT NULL::uuid,
  p_puerto_destino_id uuid DEFAULT NULL::uuid
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
  v_es_maritimo boolean := (p_modo::text = 'Marítimo');
  v_pid_origen uuid := CASE WHEN (p_modo::text = 'Marítimo') THEN p_puerto_origen_id ELSE NULL END;
  v_pid_destino uuid := CASE WHEN (p_modo::text = 'Marítimo') THEN p_puerto_destino_id ELSE NULL END;
  v_txt text;
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

  IF v_pid_origen IS NOT NULL AND v_pid_origen = v_pid_destino THEN
    RAISE EXCEPTION 'LC_PORTAL_PUERTOS_IGUALES: el origen y el destino no pueden ser el mismo puerto. Elige puertos distintos.'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_pid_origen IS NOT NULL THEN
    SELECT pt.name || ', ' || pt.country || ' (' || pt.code || ')' INTO v_txt
    FROM public.puertos pt WHERE pt.id = v_pid_origen AND pt.activo;
    IF v_txt IS NULL THEN
      RAISE EXCEPTION 'LC_PORTAL_PUERTO_INVALIDO: el puerto de origen elegido no está disponible. Vuelve a elegirlo.'
        USING ERRCODE = 'P0001';
    END IF;
    v_origen := LEFT(v_txt, 200);
  END IF;

  IF v_pid_destino IS NOT NULL THEN
    SELECT pt.name || ', ' || pt.country || ' (' || pt.code || ')' INTO v_txt
    FROM public.puertos pt WHERE pt.id = v_pid_destino AND pt.activo;
    IF v_txt IS NULL THEN
      RAISE EXCEPTION 'LC_PORTAL_PUERTO_INVALIDO: el puerto de destino elegido no está disponible. Vuelve a elegirlo.'
        USING ERRCODE = 'P0001';
    END IF;
    v_destino := LEFT(v_txt, 200);
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
    descripcion_mercancia, estado, notas, origen_portal,
    puerto_origen_id, puerto_destino_id
  ) VALUES (
    v_org, v_folio, p_cliente_id, coalesce(v_cliente_nombre, ''), p_modo, p_tipo,
    v_origen, v_destino, coalesce(nullif(LEFT(btrim(COALESCE(p_tipo_embarque, '')), 50), ''), 'FCL'),
    nullif(LEFT(btrim(coalesce(p_tipo_contenedor, '')), 100), ''),
    v_descripcion, 'Solicitada',
    '[Solicitud desde portal del cliente]' ||
      CASE WHEN v_notas IS NULL THEN '' ELSE E'\n' || v_notas END,
    true,
    v_pid_origen, v_pid_destino
  )
  RETURNING cotizaciones.id INTO v_id;

  RETURN QUERY SELECT v_id, v_folio;
END;
$function$;

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

REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion_v2(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion_v2(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text, uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion_v2(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text, uuid, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO service_role;