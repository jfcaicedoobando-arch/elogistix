-- Ola 12 · R3P-21: un REP cancelado ya no bloquea el pago. Se archiva el
-- identificador y el UUID del REP cancelado para poder re-timbrar y luego
-- cancelarlo con motivo 01 (sustitución) relacionando el nuevo REP.
ALTER TABLE public.pagos_factura
  ADD COLUMN IF NOT EXISTS rep_cancelado_facturapi_id text,
  ADD COLUMN IF NOT EXISTS rep_cancelado_uuid text;

COMMENT ON COLUMN public.pagos_factura.rep_cancelado_facturapi_id IS
  'Ola 12 R3P-21: id FacturAPI del REP cancelado, conservado para la sustitución motivo 01.';
COMMENT ON COLUMN public.pagos_factura.rep_cancelado_uuid IS
  'Ola 12 R3P-21: UUID (folio fiscal) del REP cancelado que el nuevo REP sustituye.';