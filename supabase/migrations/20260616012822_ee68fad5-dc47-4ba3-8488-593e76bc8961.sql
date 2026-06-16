ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS tarifa_id uuid REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tarifa_override jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tarifa_id ON public.cotizaciones(tarifa_id);