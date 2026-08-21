-- Ola 2 · Comisiones cierran y cierran bien (espejo desde la base, sin parches por texto).
-- O2.1 prorrateo neto del embarque · O2.2 regla de cierre · O2.5 idempotencia de anticipos · O2.6 ciclo de liquidaciones.

ALTER TABLE public.liquidaciones_comision
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'Generada',
  ADD COLUMN IF NOT EXISTS cancelada_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text;

DO $liq$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'liquidaciones_comision_estado_chk') THEN
    ALTER TABLE public.liquidaciones_comision
      ADD CONSTRAINT liquidaciones_comision_estado_chk
      CHECK (estado IN ('Generada','Pagada','Cancelada'));
  END IF;
END
$liq$;

UPDATE public.liquidaciones_comision
   SET estado = 'Pagada'
 WHERE fecha_pago IS NOT NULL AND estado = 'Generada';

DROP FUNCTION IF EXISTS public.registrar_anticipo_proveedor(uuid, numeric, moneda, date, numeric, text, text, uuid, text, uuid);

;
