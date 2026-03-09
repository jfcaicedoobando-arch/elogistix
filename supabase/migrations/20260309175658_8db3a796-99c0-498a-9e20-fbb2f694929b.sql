ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'Arribo';
ALTER TYPE public.estado_embarque ADD VALUE IF NOT EXISTS 'EIR';
ALTER TABLE public.embarques ALTER COLUMN estado SET DEFAULT 'Confirmado';