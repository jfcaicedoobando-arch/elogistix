-- Etapa 4 · Identidad opcional de puerto en oportunidades CRM (aditivo, sin backfill).
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS puerto_origen_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puerto_destino_id uuid NULL REFERENCES public.puertos(id) ON DELETE SET NULL;

-- Invariante: se permite uno solo mientras el usuario completa la captura,
-- pero nunca dos IDs iguales.
ALTER TABLE public.crm_oportunidades
  DROP CONSTRAINT IF EXISTS crm_oportunidades_puertos_distintos_chk;
ALTER TABLE public.crm_oportunidades
  ADD CONSTRAINT crm_oportunidades_puertos_distintos_chk
  CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id);

COMMENT ON COLUMN public.crm_oportunidades.puerto_origen_id IS
  'Etapa 4: identidad canónica del puerto de origen cuando el usuario lo elige del catálogo (NULL en texto libre y en históricos: no hay backfill heurístico).';
COMMENT ON COLUMN public.crm_oportunidades.puerto_destino_id IS
  'Etapa 4: identidad canónica del puerto de destino cuando el usuario lo elige del catálogo (NULL en texto libre y en históricos: no hay backfill heurístico).';