ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS tarifa_id uuid NULL REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carta_garantia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_libres_destino integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dias_almacenaje integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_seguro_usd numeric(14,2) NULL,
  ADD COLUMN IF NOT EXISTS notas text NULL;

CREATE INDEX IF NOT EXISTS idx_embarques_tarifa_id ON public.embarques(tarifa_id);