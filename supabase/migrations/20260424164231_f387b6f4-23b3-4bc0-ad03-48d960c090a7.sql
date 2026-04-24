
-- 1. Drop tabla proformas existente (incluye dependencias)
DROP TABLE IF EXISTS public.proformas CASCADE;

-- 2. Asegurar columna tiene_proforma en embarques (idempotente)
ALTER TABLE public.embarques 
  ADD COLUMN IF NOT EXISTS tiene_proforma boolean NOT NULL DEFAULT false;

-- 3. Crear tabla proformas con esquema solicitado
CREATE TABLE public.proformas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  embarque_id uuid NOT NULL REFERENCES public.embarques(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  cliente_nombre text NOT NULL,
  expediente text NOT NULL,
  bl_master text,
  subtotal_usd numeric NOT NULL DEFAULT 0,
  iva_usd numeric NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  subtotal_mxn numeric NOT NULL DEFAULT 0,
  iva_mxn numeric NOT NULL DEFAULT 0,
  total_mxn numeric NOT NULL DEFAULT 0,
  fecha_emision date NOT NULL DEFAULT CURRENT_DATE,
  notas text,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, numero)
);

CREATE INDEX idx_proformas_embarque ON public.proformas(embarque_id);
CREATE INDEX idx_proformas_cliente ON public.proformas(cliente_id);
CREATE INDEX idx_proformas_org ON public.proformas(organization_id);

-- 4. Habilitar RLS y políticas (multi-tenant + cliente lectura propia)
ALTER TABLE public.proformas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant CRUD proformas"
  ON public.proformas FOR ALL TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
  );

CREATE POLICY "Tenant viewer proformas"
  ON public.proformas FOR SELECT TO authenticated
  USING (
    ((organization_id = current_user_org_id()) OR has_role(auth.uid(), 'super_admin'::app_role))
    AND has_role(auth.uid(), 'viewer'::app_role)
  );

CREATE POLICY "Cliente read own proformas"
  ON public.proformas FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cliente'::app_role)
    AND cliente_id IN (SELECT current_user_client_ids())
  );

-- 5. Trigger updated_at
CREATE TRIGGER set_proformas_updated_at
  BEFORE UPDATE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Agregar campos a conceptos_venta
ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS estado_facturacion text NOT NULL DEFAULT 'pendiente'
    CHECK (estado_facturacion IN ('pendiente', 'en_proforma'));

ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS proforma_id uuid REFERENCES public.proformas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conceptos_venta_proforma ON public.conceptos_venta(proforma_id);

-- 7. Función para generar consecutivo PRO-YYYY-NNNN (reinicia cada año por organización)
CREATE OR REPLACE FUNCTION public.generar_numero_proforma(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_prefix text := 'PRO-' || v_year::text || '-';
  v_next int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(numero, '^PRO-\d{4}-', ''), '')::int
  ), 0) + 1
  INTO v_next
  FROM public.proformas
  WHERE organization_id = p_org_id
    AND numero LIKE v_prefix || '%';

  RETURN v_prefix || lpad(v_next::text, 4, '0');
END;
$$;

-- 8. Trigger para mantener embarques.tiene_proforma sincronizado
CREATE OR REPLACE FUNCTION public.sync_embarque_tiene_proforma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.embarques SET tiene_proforma = true WHERE id = NEW.embarque_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.embarques e
    SET tiene_proforma = EXISTS (SELECT 1 FROM public.proformas p WHERE p.embarque_id = e.id)
    WHERE e.id = OLD.embarque_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_embarque_tiene_proforma
  AFTER INSERT OR DELETE ON public.proformas
  FOR EACH ROW EXECUTE FUNCTION public.sync_embarque_tiene_proforma();
