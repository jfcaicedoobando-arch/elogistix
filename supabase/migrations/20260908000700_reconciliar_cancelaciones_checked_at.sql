-- P1-3: presupuesto y reparto justo en facturapi-reconciliar-cancelaciones.
-- Agrega el "campo canónico" de última revisión que hoy no existe en
-- facturas/factura_notas_credito/pagos_factura (sólo hay `updated_at`
-- genérico, que se pisa por cualquier otra escritura y no sirve como cursor
-- estable). Se usa para ordenar el barrido (más antiguo primero) y permitir
-- que la siguiente corrida continúe donde la anterior dejó presupuesto.

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS reconciliacion_checked_at timestamptz;

ALTER TABLE public.factura_notas_credito
  ADD COLUMN IF NOT EXISTS reconciliacion_checked_at timestamptz;

ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS rep_reconciliacion_checked_at timestamptz;

-- Índices parciales: sólo importan las filas pendientes/verificando, que son
-- las que el cron consulta ordenadas por este cursor (nulls primero = nunca
-- revisadas, máxima prioridad).
CREATE INDEX IF NOT EXISTS idx_facturas_reconciliacion_cursor
  ON public.facturas (reconciliacion_checked_at)
  WHERE cancellation_status IN ('pending', 'verifying');

CREATE INDEX IF NOT EXISTS idx_factura_notas_credito_reconciliacion_cursor
  ON public.factura_notas_credito (reconciliacion_checked_at)
  WHERE cancellation_status IN ('pending', 'verifying');

CREATE INDEX IF NOT EXISTS idx_pagos_factura_rep_reconciliacion_cursor
  ON public.pagos_factura (rep_reconciliacion_checked_at)
  WHERE rep_cancellation_status IN ('pending', 'verifying');
