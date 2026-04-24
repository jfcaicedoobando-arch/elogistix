-- Agregar campo aplica_iva a conceptos_venta para indicar si un concepto USD lleva IVA
-- Conceptos en MXN: siempre llevan IVA (manejado en código)
-- Conceptos en USD: usan este flag (default false)
ALTER TABLE public.conceptos_venta
ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;

-- Para conceptos en MXN existentes, marcar como true por consistencia
UPDATE public.conceptos_venta SET aplica_iva = true WHERE moneda = 'MXN' AND aplica_iva = false;