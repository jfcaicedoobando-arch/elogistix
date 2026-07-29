-- Catch-up 2 de drift histórico: registra en el historial columnas creadas a
-- mano en el dashboard. 100% idempotente: sobre la base actual no cambia nada.

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_revision text NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS proformas_origen uuid[];

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS estado_captura text NOT NULL DEFAULT 'capturada';

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS tipo_cambio_usd numeric NOT NULL DEFAULT 0;

ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS fecha_programada_pago date;