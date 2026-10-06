ALTER TABLE public.crm_solicitudes_pricing ADD COLUMN unidad_medida text;
ALTER TABLE public.crm_solicitudes_pricing ADD CONSTRAINT crm_solicitudes_pricing_unidad_medida_check CHECK (unidad_medida IS NULL OR unidad_medida IN ('kg', 'lb', 't', 'g'));
COMMENT ON COLUMN public.crm_solicitudes_pricing.unidad_medida IS 'Unidad de peso opcional: kg, lb, t o g. No modifica el peso capturado.';