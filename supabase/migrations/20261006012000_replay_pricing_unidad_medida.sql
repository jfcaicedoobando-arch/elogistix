-- Replay de esquema de Drizzle 0006; no cambia pesos ni unidades históricos.
ALTER TABLE public.crm_solicitudes_pricing
  ADD COLUMN IF NOT EXISTS unidad_medida text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.crm_solicitudes_pricing'::regclass
      AND conname = 'crm_solicitudes_pricing_unidad_medida_check'
  ) THEN
    ALTER TABLE public.crm_solicitudes_pricing
      ADD CONSTRAINT crm_solicitudes_pricing_unidad_medida_check
      CHECK (unidad_medida IS NULL OR unidad_medida IN ('kg', 'lb', 't', 'g'));
  END IF;
END $$;

COMMENT ON COLUMN public.crm_solicitudes_pricing.unidad_medida
  IS 'Unidad de peso opcional: kg, lb, t o g. No modifica el peso capturado.';
