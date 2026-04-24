-- Add approval workflow fields to proformas
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'borrador',
  ADD COLUMN IF NOT EXISTS consolidada_en uuid REFERENCES public.proformas(id) ON DELETE SET NULL;

-- Add CHECK constraint for estado_aprobacion (drop first if exists)
DO $$ BEGIN
  ALTER TABLE public.proformas DROP CONSTRAINT IF EXISTS proformas_estado_aprobacion_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.proformas
  ADD CONSTRAINT proformas_estado_aprobacion_check
  CHECK (estado_aprobacion IN ('borrador', 'aprobada', 'consolidada'));

-- Backfill: mark all existing proformas as 'aprobada' so legacy records remain visible
UPDATE public.proformas
SET estado_aprobacion = 'aprobada'
WHERE estado_aprobacion = 'borrador';

CREATE INDEX IF NOT EXISTS idx_proformas_estado_aprobacion ON public.proformas(estado_aprobacion);
CREATE INDEX IF NOT EXISTS idx_proformas_consolidada_en ON public.proformas(consolidada_en);