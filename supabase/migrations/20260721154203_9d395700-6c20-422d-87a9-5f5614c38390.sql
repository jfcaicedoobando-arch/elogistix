CREATE TABLE IF NOT EXISTS public.facturapi_webhook_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb,
  CONSTRAINT facturapi_webhook_eventos_unique UNIQUE (organization_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_facturapi_webhook_eventos_org_received
  ON public.facturapi_webhook_eventos (organization_id, received_at DESC);

GRANT ALL ON public.facturapi_webhook_eventos TO service_role;

ALTER TABLE public.facturapi_webhook_eventos ENABLE ROW LEVEL SECURITY;

-- Sólo service_role escribe/lee (edge function). Sin política = bloqueado
-- para anon/authenticated; RLS enforced.
CREATE POLICY "service_role manages webhook eventos"
  ON public.facturapi_webhook_eventos
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);