ALTER TABLE public.costeo_tarifas
  DROP CONSTRAINT IF EXISTS costeo_tarifas_estado_check;

ALTER TABLE public.costeo_tarifas
  ADD CONSTRAINT costeo_tarifas_estado_check
  CHECK (estado IN ('borrador','vigente','vencida','reemplazada'));