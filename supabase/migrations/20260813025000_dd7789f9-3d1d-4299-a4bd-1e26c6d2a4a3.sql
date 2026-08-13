-- Ola 11 · RNF-11: la deduplicación de movimientos bancarios debe ser contra
-- movimientos VIVOS (mismo criterio que Ola 4 · N15 y N36). Un movimiento
-- soft-borrado bloqueaba para siempre la re-creación ('pago-<id>' /
-- 'cobro-<id>') y la re-importación del estado de cuenta.
-- Pre-verificación ejecutada: 0 filas duplicadas vivas.
-- NOTA: importarMovimientos deja de usar upsert (un índice parcial no es
-- inferible como árbitro de ON CONFLICT por PostgREST).
ALTER TABLE public.bbva_movimientos
  DROP CONSTRAINT IF EXISTS bbva_movimientos_cuenta_bancaria_id_hash_dedupe_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bbva_movimientos_hash_dedupe_vivo
  ON public.bbva_movimientos (cuenta_bancaria_id, hash_dedupe)
  WHERE deleted_at IS NULL;