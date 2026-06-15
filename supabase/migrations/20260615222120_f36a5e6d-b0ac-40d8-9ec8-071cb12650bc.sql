CREATE OR REPLACE FUNCTION public.log_client_error_v1(p_message text, p_stack text DEFAULT NULL::text, p_component_stack text DEFAULT NULL::text, p_route text DEFAULT NULL::text, p_user_agent text DEFAULT NULL::text, p_app_version text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_user uuid := auth.uid();
  v_req uuid;
BEGIN
  BEGIN
    v_req := NULLIF(p_request_id, '')::uuid;
  EXCEPTION WHEN others THEN
    v_req := gen_random_uuid();
  END;

  INSERT INTO public.app_logs(level, fn, msg, request_id, user_id, status_code, latency_ms, payload)
  VALUES (
    'error', 'client',
    LEFT(COALESCE(p_message, '(sin mensaje)'), 1000),
    COALESCE(v_req, gen_random_uuid()),
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