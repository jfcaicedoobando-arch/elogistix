-- ============================================================================
-- QA ronda 2 · N-07 (1/2): nuevo estado de comisión 'Por recuperar'.
-- Se aplica en su propia migración porque un valor de enum recién agregado no
-- puede usarse dentro de la misma transacción que lo crea.
-- ============================================================================
ALTER TYPE public.estado_comision ADD VALUE IF NOT EXISTS 'Por recuperar';