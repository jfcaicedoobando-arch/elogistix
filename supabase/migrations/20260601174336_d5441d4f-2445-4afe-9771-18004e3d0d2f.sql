-- ============================================================================
-- Fase 1 Seguridad (v12.32.0): RPCs públicas + ratelimit + storage tightening
-- ============================================================================

-- 1) Tabla y RPC de rate limit (reemplaza in-memory de client-error-log)
CREATE TABLE IF NOT EXISTS public.ratelimit_buckets (
  bucket_key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ratelimit_buckets TO service_role;
ALTER TABLE public.ratelimit_buckets ENABLE ROW LEVEL SECURITY;
-- Sin policies: sólo SECURITY DEFINER puede tocarla.

CREATE OR REPLACE FUNCTION public.check_ratelimit(
  p_key text,
  p_window_seconds int DEFAULT 60,
  p_max int DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket public.ratelimit_buckets;
  v_now timestamptz := now();
  v_retry int := 0;
BEGIN
  SELECT * INTO v_bucket FROM public.ratelimit_buckets WHERE bucket_key = p_key FOR UPDATE;
  IF NOT FOUND OR (v_now - v_bucket.window_start) > make_interval(secs => p_window_seconds) THEN
    INSERT INTO public.ratelimit_buckets(bucket_key, count, window_start, updated_at)
    VALUES (p_key, 1, v_now, v_now)
    ON CONFLICT (bucket_key) DO UPDATE SET count = 1, window_start = v_now, updated_at = v_now;
    RETURN jsonb_build_object('ok', true, 'retry_after', 0);
  END IF;
  IF v_bucket.count >= p_max THEN
    v_retry := GREATEST(1, p_window_seconds - EXTRACT(EPOCH FROM (v_now - v_bucket.window_start))::int);
    RETURN jsonb_build_object('ok', false, 'retry_after', v_retry);
  END IF;
  UPDATE public.ratelimit_buckets SET count = count + 1, updated_at = v_now WHERE bucket_key = p_key;
  RETURN jsonb_build_object('ok', true, 'retry_after', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.check_ratelimit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_ratelimit(text, int, int) TO anon, authenticated, service_role;

-- 2) RPC pública para tracking (reemplaza service-role en tracking-public)
CREATE OR REPLACE FUNCTION public.get_tracking_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_embarque jsonb;
  v_eventos jsonb;
  v_org jsonb;
BEGIN
  SELECT * INTO v_link FROM public.tracking_links WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('error', 'expired');
  END IF;

  SELECT to_jsonb(e) - 'created_at' - 'updated_at' INTO v_embarque
  FROM (
    SELECT id, expediente, cliente_nombre, modo, tipo, estado, etd, eta,
           puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino,
           ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga,
           naviera, aerolinea, transportista
    FROM public.embarques WHERE id = v_link.embarque_id AND deleted_at IS NULL
  ) e;
  IF v_embarque IS NULL THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tipo', tipo, 'descripcion', descripcion, 'ubicacion', ubicacion, 'fecha', fecha
  ) ORDER BY fecha DESC), '[]'::jsonb)
  INTO v_eventos
  FROM public.eventos_embarque WHERE embarque_id = v_link.embarque_id;

  SELECT jsonb_build_object('nombre', nombre, 'logo_url', logo_url) INTO v_org
  FROM public.organizations WHERE id = v_link.organization_id;

  RETURN jsonb_build_object('embarque', v_embarque, 'eventos', v_eventos, 'organizacion', v_org);
END;
$$;
REVOKE ALL ON FUNCTION public.get_tracking_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tracking_public(text) TO anon, authenticated, service_role;

-- 3) RPC pública para insertar client error logs (reemplaza service-role)
CREATE OR REPLACE FUNCTION public.log_client_error_v1(
  p_message text,
  p_stack text DEFAULT NULL,
  p_component_stack text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
BEGIN
  INSERT INTO public.app_logs(level, fn, msg, request_id, user_id, status_code, latency_ms, payload)
  VALUES (
    'error', 'client',
    LEFT(COALESCE(p_message, '(sin mensaje)'), 1000),
    p_request_id,
    v_user,
    500, NULL,
    jsonb_build_object(
      'stack', LEFT(COALESCE(p_stack, ''), 8000),
      'component_stack', LEFT(COALESCE(p_component_stack, ''), 4000),
      'route', LEFT(COALESCE(p_route, ''), 500),
      'user_agent', LEFT(COALESCE(p_user_agent, ''), 500),
      'app_version', LEFT(COALESCE(p_app_version, ''), 50)
    )
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, text) TO anon, authenticated, service_role;

-- 4) can_manage_document_object: quitar 'storage' del search_path (storage.foldername ya está calificado)
CREATE OR REPLACE FUNCTION public.can_manage_document_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH parts AS (
    SELECT storage.foldername(ltrim(_object_name, '/')) AS folder_parts
  ), actor AS (
    SELECT
      auth.uid() AS user_id,
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'::public.app_role
      ) AS is_super_admin,
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::public.app_role, 'operador'::public.app_role)
      ) AS is_staff
  )
  SELECT COALESCE(
    (SELECT is_super_admin FROM actor)
    OR (
      (SELECT user_id FROM actor) IS NOT NULL
      AND (SELECT is_staff FROM actor)
      AND (SELECT folder_parts[1] FROM parts) = 'embarques'
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.embarques e ON e.organization_id = om.organization_id
        CROSS JOIN parts CROSS JOIN actor
        WHERE om.user_id = actor.user_id
          AND om.role IN ('admin'::public.app_role, 'operador'::public.app_role)
          AND e.deleted_at IS NULL
          AND (
            parts.folder_parts[2] = e.expediente
            OR (
              parts.folder_parts[2] = e.id::text
              AND EXISTS (
                SELECT 1 FROM public.documentos_embarque d
                WHERE d.id::text = parts.folder_parts[3]
                  AND d.embarque_id = e.id
                  AND d.organization_id = e.organization_id
                  AND d.deleted_at IS NULL
              )
            )
          )
      )
    ),
    false
  );
$function$;

-- 5) Storage policies: restringir {public} -> {authenticated}
DROP POLICY IF EXISTS "Admin/operador upload documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador delete documentos" ON storage.objects;

CREATE POLICY "Admin/operador upload documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos' AND auth.uid() IS NOT NULL AND public.can_manage_document_object(name));

CREATE POLICY "Admin/operador update documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos' AND auth.uid() IS NOT NULL AND public.can_manage_document_object(name))
WITH CHECK (bucket_id = 'documentos' AND auth.uid() IS NOT NULL AND public.can_manage_document_object(name));

CREATE POLICY "Admin/operador delete documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND auth.uid() IS NOT NULL AND public.can_manage_document_object(name));
