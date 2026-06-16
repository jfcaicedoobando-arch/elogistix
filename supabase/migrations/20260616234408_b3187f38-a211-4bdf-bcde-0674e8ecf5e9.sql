-- Backfill: la tabla public.tracking_webhook_log existe en producción pero
-- nunca fue creada por una migración, por lo que el snapshot de CI (que
-- replica únicamente migraciones) fallaba al ejecutar los GRANTs de la
-- migración 20260616233650. Esta migración la crea si falta y re-aplica
-- grants/RLS/policy de forma idempotente.

CREATE TABLE IF NOT EXISTS public.tracking_webhook_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL DEFAULT 'terminal49',
  event_id text,
  event_type text NOT NULL,
  tracking_request_id text,
  shipment_id text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT tracking_webhook_log_provider_event_id_key UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_tracking_webhook_log_event_type
  ON public.tracking_webhook_log (event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_webhook_log_processed
  ON public.tracking_webhook_log (processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_tracking_webhook_log_received_at
  ON public.tracking_webhook_log (received_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_webhook_log TO authenticated;
GRANT ALL ON public.tracking_webhook_log TO service_role;

ALTER TABLE public.tracking_webhook_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin read webhook log" ON public.tracking_webhook_log;
CREATE POLICY "Super admin read webhook log"
  ON public.tracking_webhook_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));
