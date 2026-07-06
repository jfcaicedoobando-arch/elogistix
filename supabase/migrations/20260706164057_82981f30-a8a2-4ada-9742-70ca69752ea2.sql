ALTER TABLE public.proformas ADD COLUMN IF NOT EXISTS origen TEXT;
COMMENT ON COLUMN public.proformas.origen IS 'Marca el origen de la proforma. NULL = creada en el sistema. "legacy_erp" = importada del ERP anterior sin evidencia de factura.';
CREATE INDEX IF NOT EXISTS idx_proformas_origen ON public.proformas(organization_id, origen) WHERE origen IS NOT NULL;