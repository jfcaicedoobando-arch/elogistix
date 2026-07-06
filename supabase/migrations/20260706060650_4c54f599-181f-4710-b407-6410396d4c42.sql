-- Ola 2 · Item 2 — Programación de pagos a proveedor.
-- Agrega la fecha en que Tesorería planea ejecutar el pago de una factura
-- de proveedor. Sirve como base para las bandejas "Por programar" y
-- "Por ejecutar" y para la proyección semanal de flujo.
ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS fecha_programada_pago date;

COMMENT ON COLUMN public.proveedor_facturas.fecha_programada_pago IS
'Fecha en la que Tesorería programó el pago de esta factura. NULL = sin programar (bandeja "Por programar"). Fecha <= hoy+N = "Por ejecutar".';

-- Índice parcial: sólo indexa filas con saldo pendiente y programación,
-- que son las que las bandejas de tesorería consultan.
CREATE INDEX IF NOT EXISTS idx_prov_fact_fecha_prog_pago
  ON public.proveedor_facturas (fecha_programada_pago)
  WHERE fecha_programada_pago IS NOT NULL AND deleted_at IS NULL;