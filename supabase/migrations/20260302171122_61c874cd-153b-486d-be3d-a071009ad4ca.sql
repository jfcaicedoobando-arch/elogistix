
-- Nuevo estado "Aceptada"
ALTER TYPE public.estado_cotizacion ADD VALUE 'Aceptada';

-- Campos de prospecto
ALTER TABLE public.cotizaciones ADD COLUMN es_prospecto boolean NOT NULL DEFAULT false;
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_empresa text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_contacto text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_email text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN prospecto_telefono text NOT NULL DEFAULT '';

-- Permitir cliente_id nullable (prospectos no tienen cliente aún)
ALTER TABLE public.cotizaciones ALTER COLUMN cliente_id DROP NOT NULL;
