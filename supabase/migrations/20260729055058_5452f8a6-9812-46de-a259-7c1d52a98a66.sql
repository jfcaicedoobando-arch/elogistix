-- Catch-up de drift histórico (radar types-drift): campos de public.proformas
-- creados manualmente y sin migración. 100% idempotente.

-- Columnas base que en producción ya existen (declaradas en migraciones legacy
-- que no aplican sobre una base reconstruida). Se re-declaran de forma
-- idempotente para que esta migración sea autosuficiente en base limpia.
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false;

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'Aprobada';

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_revision text NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS proformas_origen uuid[];

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS consolidada_en uuid;

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS embarques_ids uuid[];

ALTER TABLE public.proformas
  ALTER COLUMN embarque_id DROP NOT NULL;

ALTER TABLE public.proformas
  ALTER COLUMN estado_aprobacion SET DEFAULT 'borrador'::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.proformas'::regclass
      AND conname = 'proformas_consolidada_en_fkey'
  ) THEN
    ALTER TABLE public.proformas
      ADD CONSTRAINT proformas_consolidada_en_fkey
      FOREIGN KEY (consolidada_en) REFERENCES public.proformas(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proformas_consolidada_en
  ON public.proformas (consolidada_en) WHERE consolidada_en IS NOT NULL;