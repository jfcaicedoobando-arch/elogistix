-- Empareja public.cotizaciones con los campos que las RPC crear_embarque_borrador_core
-- leen vía v_cot.*. Producción ya tiene todas (se agregaron out-of-band), pero la
-- secuencia de migraciones sólo las tenía en public.embarques, por lo que CI
-- (snapshot desde cero) rompía con "column c.dias_almacenaje does not exist".
-- Todo es ADD COLUMN IF NOT EXISTS: idempotente, seguro en prod.

ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS dias_almacenaje     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carta_garantia      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dias_libres_destino integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seguro              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_seguro_usd    numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tarifa_id           uuid NULL REFERENCES public.costeo_tarifas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizaciones_tarifa_id ON public.cotizaciones(tarifa_id);