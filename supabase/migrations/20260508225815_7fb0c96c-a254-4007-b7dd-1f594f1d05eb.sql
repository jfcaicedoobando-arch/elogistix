
-- Tabla principal: vincula embarques con tracking de Terminal49
CREATE TABLE public.tracking_externo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  provider text NOT NULL DEFAULT 'terminal49',
  tracking_request_id text,
  shipment_id text,
  request_number text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('bill_of_lading','booking_number','container')),
  scac text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  failed_reason text,
  last_event_at timestamptz,
  last_synced_at timestamptz,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (embarque_id, provider)
);

CREATE INDEX idx_tracking_externo_embarque ON public.tracking_externo(embarque_id);
CREATE INDEX idx_tracking_externo_org ON public.tracking_externo(organization_id);
CREATE INDEX idx_tracking_externo_request_id ON public.tracking_externo(tracking_request_id);
CREATE INDEX idx_tracking_externo_shipment_id ON public.tracking_externo(shipment_id);

ALTER TABLE public.tracking_externo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD tracking_externo"
ON public.tracking_externo FOR ALL TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operador') OR has_role(auth.uid(),'super_admin'))
)
WITH CHECK (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'operador') OR has_role(auth.uid(),'super_admin'))
);

CREATE POLICY "Tenant viewer tracking_externo"
ON public.tracking_externo FOR SELECT TO authenticated
USING (
  ((organization_id = current_user_org_id()) OR has_role(auth.uid(),'super_admin'))
  AND has_role(auth.uid(),'viewer')
);

CREATE POLICY "Cliente read own tracking_externo"
ON public.tracking_externo FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'cliente')
  AND embarque_id IN (
    SELECT id FROM public.embarques
    WHERE cliente_id IN (SELECT current_user_client_ids())
  )
);

CREATE TRIGGER trg_tracking_externo_updated
BEFORE UPDATE ON public.tracking_externo
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bitácora de webhooks recibidos
CREATE TABLE public.tracking_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  UNIQUE (provider, event_id)
);

CREATE INDEX idx_tracking_webhook_log_event_type ON public.tracking_webhook_log(event_type);
CREATE INDEX idx_tracking_webhook_log_received_at ON public.tracking_webhook_log(received_at DESC);
CREATE INDEX idx_tracking_webhook_log_processed ON public.tracking_webhook_log(processed) WHERE processed = false;

ALTER TABLE public.tracking_webhook_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read webhook log"
ON public.tracking_webhook_log FOR SELECT TO authenticated
USING (has_role(auth.uid(),'super_admin'));
