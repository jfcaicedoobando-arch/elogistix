
-- Drop existing table
DROP TABLE IF EXISTS public.cotizacion_costos;

-- Create new table
CREATE TABLE public.cotizacion_costos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  concepto text NOT NULL,
  moneda text NOT NULL CHECK (moneda IN ('USD', 'MXN')),
  proveedor text NOT NULL DEFAULT '',
  cantidad numeric NOT NULL DEFAULT 1,
  costo_unitario numeric NOT NULL DEFAULT 0,
  costo_total numeric GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cotizacion_costos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins y operadores CRUD cotizacion_costos"
ON public.cotizacion_costos
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador'));

CREATE POLICY "Viewers pueden ver cotizacion_costos"
ON public.cotizacion_costos
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'viewer'));

-- Index
CREATE INDEX idx_cotizacion_costos_cotizacion ON public.cotizacion_costos(cotizacion_id);

-- Updated_at trigger
CREATE TRIGGER update_cotizacion_costos_updated_at
BEFORE UPDATE ON public.cotizacion_costos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
