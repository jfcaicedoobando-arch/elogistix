
ALTER TABLE public.conceptos_factura
  ADD COLUMN IF NOT EXISTS tipo_iva text NOT NULL DEFAULT 'gravado_16',
  ADD COLUMN IF NOT EXISTS tasa_iva_aplicada numeric(6,4);

ALTER TABLE public.conceptos_factura
  DROP CONSTRAINT IF EXISTS conceptos_factura_tipo_iva_check;

ALTER TABLE public.conceptos_factura
  ADD CONSTRAINT conceptos_factura_tipo_iva_check
  CHECK (tipo_iva IN ('gravado_16','tasa_0','exento'));

UPDATE public.conceptos_factura
SET tasa_iva_aplicada = CASE
  WHEN tipo_iva = 'gravado_16' THEN 0.16
  WHEN tipo_iva = 'tasa_0' THEN 0
  ELSE NULL
END
WHERE tasa_iva_aplicada IS NULL AND tipo_iva IS NOT NULL;
