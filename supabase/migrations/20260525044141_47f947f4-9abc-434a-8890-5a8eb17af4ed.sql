CREATE OR REPLACE FUNCTION public.detectar_alertas_app_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_row RECORD;
  v_dedupe TEXT;
BEGIN
  FOR v_row IN
    SELECT
      fn AS function_name,
      COUNT(*) AS errores,
      MAX(ts) AS last_error_at
    FROM public.app_logs
    WHERE ts > now() - INTERVAL '5 minutes'
      AND status_code >= 500
    GROUP BY fn
    HAVING COUNT(*) >= 5
  LOOP
    v_dedupe := 'app_logs:' || v_row.function_name || ':' ||
                to_char(date_trunc('hour', now()), 'YYYY-MM-DD-HH24');

    INSERT INTO public.alertas_sistema (severity, source, message, payload, dedupe_key)
    VALUES (
      CASE WHEN v_row.errores >= 20 THEN 'critical' ELSE 'error' END,
      'app_logs',
      format('Función %s: %s errores en los últimos 5 minutos',
             v_row.function_name, v_row.errores),
      jsonb_build_object(
        'function_name', v_row.function_name,
        'errores', v_row.errores,
        'last_error_at', v_row.last_error_at
      ),
      v_dedupe
    )
    ON CONFLICT (dedupe_key) WHERE acknowledged_at IS NULL AND dedupe_key IS NOT NULL
    DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END LOOP;

  RETURN v_inserted;
END;
$function$;