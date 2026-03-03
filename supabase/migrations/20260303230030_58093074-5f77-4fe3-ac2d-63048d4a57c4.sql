
-- Agregar columnas para vincular embarques por referencia de operación
ALTER TABLE public.embarques
  ADD COLUMN referencia_operacion text,
  ADD COLUMN embarque_padre_id uuid REFERENCES public.embarques(id) ON DELETE SET NULL;

-- Índice para búsquedas rápidas por referencia de operación
CREATE INDEX idx_embarques_referencia_operacion ON public.embarques(referencia_operacion) WHERE referencia_operacion IS NOT NULL;

-- Índice para buscar hijos de un embarque padre
CREATE INDEX idx_embarques_padre_id ON public.embarques(embarque_padre_id) WHERE embarque_padre_id IS NOT NULL;
