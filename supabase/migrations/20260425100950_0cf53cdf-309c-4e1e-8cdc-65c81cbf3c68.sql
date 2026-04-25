-- Trazabilidad histórica de la tasa de IVA aplicada en proformas y conceptos consolidados.
-- Si la organización cambia su tasa de IVA en el futuro, los snapshots conservan la tasa con la que se calcularon.

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS tasa_iva_aplicada numeric NOT NULL DEFAULT 0.16;

ALTER TABLE public.proforma_conceptos_consolidados
  ADD COLUMN IF NOT EXISTS tasa_iva_aplicada numeric NOT NULL DEFAULT 0.16;

COMMENT ON COLUMN public.proformas.tasa_iva_aplicada IS
  'Tasa de IVA (decimal, p.ej. 0.16) usada al calcular subtotal/iva/total al momento de crear o consolidar la proforma. Inmutable para auditoría.';

COMMENT ON COLUMN public.proforma_conceptos_consolidados.tasa_iva_aplicada IS
  'Tasa de IVA (decimal, p.ej. 0.16) usada al calcular el IVA de este concepto consolidado. Inmutable para auditoría.';