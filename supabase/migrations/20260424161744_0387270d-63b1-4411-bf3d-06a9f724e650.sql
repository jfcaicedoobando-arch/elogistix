-- Enum para estado de proforma
CREATE TYPE public.estado_proforma AS ENUM ('Pendiente', 'Facturada', 'Cancelada');

-- Bandera en embarques
ALTER TABLE public.embarques 
  ADD COLUMN IF NOT EXISTS tiene_proforma boolean NOT NULL DEFAULT false;

-- Tabla de proformas
CREATE TABLE public.proformas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  embarque_id uuid NOT NULL,
  expediente text NOT NULL DEFAULT '',
  cliente_id uuid,
  cliente_nombre text NOT NULL DEFAULT '',
  numero text NOT NULL,
  conceptos jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  iva numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  moneda public.moneda NOT NULL DEFAULT 'MXN'::public.moneda,
  estado public.estado_proforma NOT NULL DEFAULT 'Pendiente'::public.estado_proforma,
  factura_externa_folio text,
  fecha_facturacion date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

CREATE INDEX idx_proformas_embarque ON public.proformas(embarque_id);
CREATE INDEX idx_proformas_org ON public.proformas(organization_id);
CREATE INDEX idx_proformas_estado ON public.proformas(estado);

ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;

-- RLS: tenant CRUD para staff
CREATE POLICY "Tenant CRUD proformas" ON public.proformas
  FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

-- RLS: viewer
CREATE POLICY "Tenant viewer proformas" ON public.proformas
  FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role)
  );

-- RLS: cliente lee solo sus proformas
CREATE POLICY "Cliente read own proformas" ON public.proformas
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND (cliente_id IN (SELECT current_user_client_ids()))
  );

-- Trigger updated_at
CREATE TRIGGER trg_proformas_updated_at
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger sincroniza embarques.tiene_proforma
CREATE OR REPLACE FUNCTION public.sync_tiene_proforma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embarque_id uuid;
  v_existe boolean;
BEGIN
  v_embarque_id := COALESCE(NEW.embarque_id, OLD.embarque_id);
  SELECT EXISTS(
    SELECT 1 FROM public.proformas
    WHERE embarque_id = v_embarque_id AND estado != 'Cancelada'
  ) INTO v_existe;

  UPDATE public.embarques SET tiene_proforma = v_existe WHERE id = v_embarque_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_tiene_proforma
  AFTER INSERT OR UPDATE OR DELETE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.sync_tiene_proforma();

-- RPC: marcar como facturada
CREATE OR REPLACE FUNCTION public.marcar_proforma_facturada(
  p_id uuid,
  p_folio text,
  p_fecha date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.proformas
  SET estado = 'Facturada'::estado_proforma,
      factura_externa_folio = p_folio,
      fecha_facturacion = p_fecha,
      updated_at = now()
  WHERE id = p_id
    AND (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'::app_role));
END;
$$;