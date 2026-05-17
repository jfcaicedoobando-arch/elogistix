-- Tabla de alertas internas
CREATE TABLE IF NOT EXISTS public.alertas_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  severity TEXT NOT NULL DEFAULT 'warning',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);

CREATE INDEX IF NOT EXISTS idx_alertas_sistema_created_at ON public.alertas_sistema (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_sistema_unack ON public.alertas_sistema (acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alertas_sistema_dedupe_open
  ON public.alertas_sistema (dedupe_key)
  WHERE acknowledged_at IS NULL AND dedupe_key IS NOT NULL;

ALTER TABLE public.alertas_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin lee alertas"
  ON public.alertas_sistema
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "super_admin actualiza alertas"
  ON public.alertas_sistema
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

-- Detector de alertas: ≥5 errores de la misma función en últimos 5 min
CREATE OR REPLACE FUNCTION public.detectar_alertas_app_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_row RECORD;
  v_dedupe TEXT;
BEGIN
  FOR v_row IN
    SELECT
      function_name,
      COUNT(*) AS errores,
      MAX(created_at) AS last_error_at
    FROM public.app_logs
    WHERE created_at > now() - INTERVAL '5 minutes'
      AND status >= 500
    GROUP BY function_name
    HAVING COUNT(*) >= 5
  LOOP
    v_dedupe := 'app_logs:' || v_row.function_name || ':' || to_char(date_trunc('hour', now()), 'YYYY-MM-DD-HH24');

    INSERT INTO public.alertas_sistema (severity, source, message, payload, dedupe_key)
    VALUES (
      CASE WHEN v_row.errores >= 20 THEN 'critical' ELSE 'error' END,
      'app_logs',
      format('Función %s: %s errores en los últimos 5 minutos', v_row.function_name, v_row.errores),
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
$$;

-- RPC para conteo de alertas no reconocidas (sidebar)
CREATE OR REPLACE FUNCTION public.alertas_sistema_pending_count()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.alertas_sistema
  WHERE acknowledged_at IS NULL;
$$;

-- Programar cron cada 5 minutos
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.schedule(
  'detectar-alertas-app-logs',
  '*/5 * * * *',
  $$ SELECT public.detectar_alertas_app_logs(); $$
);