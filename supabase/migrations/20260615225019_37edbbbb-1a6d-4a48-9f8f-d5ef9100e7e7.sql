-- Fix: tipar p_request_id como uuid para evitar errores de cast en app_logs.request_id
DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.log_client_error_v1(
  p_message text,
  p_stack text DEFAULT NULL,
  p_component_stack text DEFAULT NULL,
  p_route text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
BEGIN
  INSERT INTO public.app_logs(level, fn, msg, request_id, user_id, status_code, latency_ms, payload)
  VALUES (
    'error', 'client',
    LEFT(COALESCE(p_message, '(sin mensaje)'), 1000),
    COALESCE(p_request_id, gen_random_uuid()),
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
$function$;

REVOKE ALL ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) TO anon, authenticated, service_role;