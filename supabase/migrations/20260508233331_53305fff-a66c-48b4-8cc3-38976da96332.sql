CREATE TABLE public.tracking_intentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'terminal49',
  accion text NOT NULL DEFAULT 'create',
  request_type text,
  request_number text,
  scac text,
  resultado text NOT NULL,
  http_status integer,
  tracking_request_id text,
  mensaje text,
  detalle jsonb DEFAULT '{}'::jsonb,
  usuario_id uuid,
  usuario_email text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_intentos_embarque ON public.tracking_intentos(embarque_id, created_at DESC);
CREATE INDEX idx_tracking_intentos_org ON public.tracking_intentos(organization_id);

ALTER TABLE public.tracking_intentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read tracking_intentos"
ON public.tracking_intentos FOR SELECT
TO authenticated
USING (
  (organization_id = current_user_org_id())
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Tenant insert tracking_intentos"
ON public.tracking_intentos FOR INSERT
TO authenticated
WITH CHECK (
  (organization_id = current_user_org_id())
  OR has_role(auth.uid(), 'super_admin'::app_role)
);