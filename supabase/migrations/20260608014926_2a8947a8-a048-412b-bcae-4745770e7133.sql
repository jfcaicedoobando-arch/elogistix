ALTER TABLE public.conceptos_venta
  ADD COLUMN IF NOT EXISTS tasa_iva_aplicada NUMERIC(5,4) NOT NULL DEFAULT 0.16;

ALTER TABLE public.conceptos_costo
  ADD COLUMN IF NOT EXISTS tasa_iva_aplicada NUMERIC(5,4) NOT NULL DEFAULT 0.16;

ALTER TABLE public.conceptos_venta DISABLE TRIGGER USER;
UPDATE public.conceptos_venta
  SET tasa_iva_aplicada = CASE WHEN aplica_iva THEN 0.16 ELSE 0 END;
ALTER TABLE public.conceptos_venta ENABLE TRIGGER USER;

ALTER TABLE public.conceptos_venta
  DROP CONSTRAINT IF EXISTS conceptos_venta_tasa_iva_chk,
  ADD CONSTRAINT conceptos_venta_tasa_iva_chk CHECK (tasa_iva_aplicada >= 0 AND tasa_iva_aplicada <= 1);

ALTER TABLE public.conceptos_costo
  DROP CONSTRAINT IF EXISTS conceptos_costo_tasa_iva_chk,
  ADD CONSTRAINT conceptos_costo_tasa_iva_chk CHECK (tasa_iva_aplicada >= 0 AND tasa_iva_aplicada <= 1);