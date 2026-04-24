
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS embarques_ids uuid[];

ALTER TABLE public.proformas
  ALTER COLUMN embarque_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proformas_embarques_ids ON public.proformas USING GIN(embarques_ids);
