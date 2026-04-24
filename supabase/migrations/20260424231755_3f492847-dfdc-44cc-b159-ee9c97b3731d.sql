-- Agregar campo estado_revision con check constraint
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS estado_revision text NOT NULL DEFAULT 'pendiente';

-- Agregar check constraint para los valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proformas_estado_revision_check'
  ) THEN
    ALTER TABLE public.proformas
      ADD CONSTRAINT proformas_estado_revision_check
      CHECK (estado_revision IN ('pendiente', 'aprobada', 'consolidada'));
  END IF;
END $$;

-- Agregar campo proformas_origen (array de UUIDs)
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS proformas_origen uuid[];

-- Migrar proformas existentes a estado 'aprobada' para que sigan apareciendo como siempre
UPDATE public.proformas
SET estado_revision = 'aprobada'
WHERE estado_revision = 'pendiente';

-- Asegurar default false en es_consolidada (ya existe la columna)
UPDATE public.proformas
SET es_consolidada = false
WHERE es_consolidada IS NULL;