ALTER TABLE public.embarque_facturas_entrantes
  ADD COLUMN IF NOT EXISTS monto_declarado numeric(14,2),
  ADD COLUMN IF NOT EXISTS moneda_declarada text;

ALTER TABLE public.embarque_facturas_entrantes
  DROP CONSTRAINT IF EXISTS chk_efe_moneda_declarada;

ALTER TABLE public.embarque_facturas_entrantes
  ADD CONSTRAINT chk_efe_moneda_declarada
  CHECK (moneda_declarada IS NULL OR moneda_declarada IN ('MXN','USD','EUR'));

ALTER TABLE public.embarque_facturas_entrantes
  DROP CONSTRAINT IF EXISTS chk_efe_monto_declarado_positivo;

ALTER TABLE public.embarque_facturas_entrantes
  ADD CONSTRAINT chk_efe_monto_declarado_positivo
  CHECK (monto_declarado IS NULL OR monto_declarado > 0);

COMMENT ON COLUMN public.embarque_facturas_entrantes.monto_declarado IS
  'Monto de la factura capturado por operaciones al subir el documento; se usa para cotejar contra los costos del embarque.';
COMMENT ON COLUMN public.embarque_facturas_entrantes.moneda_declarada IS
  'Moneda del monto declarado (MXN/USD/EUR).';