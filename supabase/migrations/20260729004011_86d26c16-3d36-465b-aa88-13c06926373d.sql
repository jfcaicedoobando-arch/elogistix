-- ============================================================================
-- Catch-up de drift histórico: registra en el historial de migraciones objetos
-- que se crearon manualmente en el dashboard y nunca tuvieron migración.
-- 100% idempotente: sobre la base actual no cambia absolutamente nada.
-- ============================================================================

-- 1) public.proformas: columnas huérfanas -----------------------------------
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false;

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'Aprobada';

-- 2) public.tracking_externo -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_externo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  provider text NOT NULL DEFAULT 'terminal49',
  tracking_request_id text,
  shipment_id text,
  request_number text NOT NULL,
  request_type text NOT NULL,
  scac text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  failed_reason text,
  last_event_at timestamptz,
  last_synced_at timestamptz,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_externo_embarque_id_provider_key UNIQUE (embarque_id, provider),
  CONSTRAINT tracking_externo_request_type_check
    CHECK (request_type = ANY (ARRAY['bill_of_lading'::text, 'booking_number'::text, 'container'::text]))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_externo TO authenticated;
GRANT ALL ON public.tracking_externo TO service_role;
ALTER TABLE public.tracking_externo ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tracking_externo_embarque ON public.tracking_externo (embarque_id);
CREATE INDEX IF NOT EXISTS idx_tracking_externo_org ON public.tracking_externo (organization_id);
CREATE INDEX IF NOT EXISTS idx_tracking_externo_request_id ON public.tracking_externo (tracking_request_id);
CREATE INDEX IF NOT EXISTS idx_tracking_externo_shipment_id ON public.tracking_externo (shipment_id);

DROP POLICY IF EXISTS "Tenant CRUD tracking_externo" ON public.tracking_externo;
CREATE POLICY "Tenant CRUD tracking_externo" ON public.tracking_externo
  FOR ALL TO authenticated
  USING (
    ((organization_id = (SELECT current_user_org_id()))
      OR has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (has_role((SELECT auth.uid()), 'admin'::app_role)
      OR has_role((SELECT auth.uid()), 'operador'::app_role)
      OR has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = (SELECT current_user_org_id()))
      OR has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (has_role((SELECT auth.uid()), 'admin'::app_role)
      OR has_role((SELECT auth.uid()), 'operador'::app_role)
      OR has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

DROP POLICY IF EXISTS "Tenant viewer tracking_externo" ON public.tracking_externo;
CREATE POLICY "Tenant viewer tracking_externo" ON public.tracking_externo
  FOR SELECT TO authenticated
  USING (
    ((organization_id = (SELECT current_user_org_id()))
      OR has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND has_role((SELECT auth.uid()), 'viewer'::app_role)
  );

DROP POLICY IF EXISTS "Cliente read own tracking_externo" ON public.tracking_externo;
CREATE POLICY "Cliente read own tracking_externo" ON public.tracking_externo
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'cliente'::app_role)
    AND embarque_id IN (
      SELECT e.id FROM public.embarques e
      WHERE e.cliente_id IN (SELECT current_user_client_ids())
    )
  );

DROP TRIGGER IF EXISTS trg_tracking_externo_updated ON public.tracking_externo;
CREATE TRIGGER trg_tracking_externo_updated
  BEFORE UPDATE ON public.tracking_externo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) public.tracking_intentos ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracking_intentos (
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
  usuario_email text DEFAULT ''::text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_intentos TO authenticated;
GRANT ALL ON public.tracking_intentos TO service_role;
ALTER TABLE public.tracking_intentos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_tracking_intentos_embarque
  ON public.tracking_intentos (embarque_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_intentos_org
  ON public.tracking_intentos (organization_id);

DROP POLICY IF EXISTS "Staff read tracking_intentos" ON public.tracking_intentos;
CREATE POLICY "Staff read tracking_intentos" ON public.tracking_intentos
  FOR SELECT TO authenticated
  USING (
    has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR ((organization_id = (SELECT current_user_org_id()))
      AND (has_role((SELECT auth.uid()), 'admin'::app_role)
        OR has_role((SELECT auth.uid()), 'operador'::app_role)))
  );

DROP POLICY IF EXISTS "Staff insert tracking_intentos" ON public.tracking_intentos;
CREATE POLICY "Staff insert tracking_intentos" ON public.tracking_intentos
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role((SELECT auth.uid()), 'super_admin'::app_role)
    OR ((organization_id = (SELECT current_user_org_id()))
      AND (has_role((SELECT auth.uid()), 'admin'::app_role)
        OR has_role((SELECT auth.uid()), 'operador'::app_role)))
  );