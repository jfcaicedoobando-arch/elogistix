ALTER TABLE public.crm_solicitudes_pricing
  ADD COLUMN IF NOT EXISTS tipo_operacion text,
  ADD COLUMN IF NOT EXISTS sector_economico text;
ALTER TABLE public.crm_solicitudes_pricing
  ADD CONSTRAINT crm_solicitudes_pricing_tipo_operacion_chk
  CHECK (tipo_operacion IS NULL OR tipo_operacion IN ('Importación','Exportación','Nacional','Cross Trade','Intra USA'));