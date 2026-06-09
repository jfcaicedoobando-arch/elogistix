ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS modalidad_equipo text NULL,
  ADD COLUMN IF NOT EXISTS punto_intermedio text NULL;