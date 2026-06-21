
-- 1. Hacer embarque_id opcional en facturas (proforma_id ya es nullable)
ALTER TABLE public.facturas ALTER COLUMN embarque_id DROP NOT NULL;

-- 2. Agregar columna `origen` para distinguir facturas manuales
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'origen_factura') THEN
    CREATE TYPE public.origen_factura AS ENUM ('proforma', 'manual');
  END IF;
END $$;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS origen public.origen_factura NOT NULL DEFAULT 'proforma';

-- 3. Tabla de conceptos para facturas manuales
CREATE TABLE IF NOT EXISTS public.factura_conceptos_manuales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT current_user_org_id(),
  descripcion text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario numeric NOT NULL DEFAULT 0 CHECK (precio_unitario >= 0),
  importe numeric NOT NULL DEFAULT 0,
  clave_sat_producto text NOT NULL DEFAULT '78101800',
  clave_sat_unidad text NOT NULL DEFAULT 'E48',
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_conceptos_manuales TO authenticated;
GRANT ALL ON public.factura_conceptos_manuales TO service_role;

ALTER TABLE public.factura_conceptos_manuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "factura_conceptos_manuales select tenancy"
  ON public.factura_conceptos_manuales FOR SELECT TO authenticated
  USING (organization_id = current_user_org_id());

CREATE POLICY "factura_conceptos_manuales insert tenancy"
  ON public.factura_conceptos_manuales FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_user_org_id());

CREATE POLICY "factura_conceptos_manuales update tenancy"
  ON public.factura_conceptos_manuales FOR UPDATE TO authenticated
  USING (organization_id = current_user_org_id())
  WITH CHECK (organization_id = current_user_org_id());

CREATE POLICY "factura_conceptos_manuales delete tenancy"
  ON public.factura_conceptos_manuales FOR DELETE TO authenticated
  USING (organization_id = current_user_org_id());

CREATE INDEX IF NOT EXISTS idx_fcm_factura_id ON public.factura_conceptos_manuales(factura_id);

CREATE TRIGGER trg_fcm_updated_at
  BEFORE UPDATE ON public.factura_conceptos_manuales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
