-- ============================================================================
-- fix3 (tanda 3) — portal_solicitar_cotizacion: rate limit y caps de longitud.
--
-- Hallazgo (bugs2/public_surface_hunter.md, P3): cualquier usuario del portal
-- cliente podía crear cotizaciones en estado 'Solicitada' ilimitadas (folio de
-- folio_secuencias, triggers, ruido en la bandeja de pricing) y los textos
-- (origen/destino/descripcion/notas) no tenían límite de longitud.
--
-- Fix:
--   1. check_ratelimit por (cliente, usuario): 10 solicitudes por hora,
--      alineado con el tope recomendado y con los límites de las demás RPCs
--      de escritura del portal (portal_responder_por_token: 10/min).
--   2. Caps: origen/destino 200, descripcion_mercancia 2000, notas 2000,
--      tipo_embarque 50, tipo_contenedor 100 (truncado, mismo estilo que
--      log_client_error_v1 con LEFT).
--
-- Cuerpo idéntico al vigente (20260730012640) salvo los bloques marcados.
-- Los GRANTs se conservan: authenticated + service_role (NO anon — esta RPC
-- exige sesión y vínculo client_users; ver decisión en 20260831200400).
-- ============================================================================

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
  -- fix3: caps de longitud (antes text sin límite).
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

  -- fix3: rate limit por (cliente, usuario) — 10 solicitudes/hora.
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

-- Permisos: sin cambios (nunca fue anon; requiere sesión del portal cliente).
REVOKE ALL ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_cotizacion(uuid, modo_transporte, tipo_operacion, text, text, text, text, text, text)
  TO service_role;
