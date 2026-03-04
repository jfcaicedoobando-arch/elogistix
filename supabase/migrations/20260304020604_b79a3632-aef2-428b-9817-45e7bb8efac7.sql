
CREATE TABLE public.cotizacion_costos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid REFERENCES public.cotizaciones(id) ON DELETE CASCADE NOT NULL,
  concepto text NOT NULL,
  proveedor text,
  moneda text NOT NULL DEFAULT 'USD',
  unidad_medida text,
  costo numeric NOT NULL DEFAULT 0,
  venta numeric NOT NULL DEFAULT 0,
  profit numeric GENERATED ALWAYS AS (venta - costo) STORED,
  porcentaje_profit numeric GENERATED ALWAYS AS (
    CASE WHEN venta = 0 THEN 0
    ELSE ROUND(((venta - costo) / venta) * 100, 2)
    END
  ) STORED,
  seccion text CHECK (seccion IN ('Origen', 'Flete Internacional', 'Destino', 'Otro')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cotizacion_costos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins y operadores CRUD cotizacion_costos"
ON public.cotizacion_costos
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role));

CREATE POLICY "Viewers pueden ver cotizacion_costos"
ON public.cotizacion_costos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'viewer'::app_role));

CREATE TRIGGER update_cotizacion_costos_updated_at
BEFORE UPDATE ON public.cotizacion_costos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
