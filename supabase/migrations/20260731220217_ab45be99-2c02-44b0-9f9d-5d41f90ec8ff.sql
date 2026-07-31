-- 1) Nuevo estado administrativo entre EIR y Cerrado.
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'Por liquidar' BEFORE 'Cerrado';

-- 2) Permitir registrar cierres automáticos en la bitácora de cierre.
ALTER TABLE public.cierre_embarque_log
  DROP CONSTRAINT IF EXISTS cierre_embarque_log_accion_check;

ALTER TABLE public.cierre_embarque_log
  ADD CONSTRAINT cierre_embarque_log_accion_check
  CHECK (accion = ANY (ARRAY['cerrar'::text, 'cerrar_forzado'::text, 'cerrar_automatico'::text, 'reabrir'::text]));