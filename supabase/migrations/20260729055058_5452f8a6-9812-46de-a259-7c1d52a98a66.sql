-- Catch-up de drift histórico (radar types-drift): campos de public.proformas
-- creados manualmente y sin migración. 100% idempotente.

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