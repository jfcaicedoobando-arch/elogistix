
ALTER TABLE public.cotizaciones ADD COLUMN tipo_embarque text NOT NULL DEFAULT 'FCL';
ALTER TABLE public.cotizaciones ADD COLUMN tipo_contenedor text;
ALTER TABLE public.cotizaciones ADD COLUMN tipo_peso text NOT NULL DEFAULT 'Peso Normal';
ALTER TABLE public.cotizaciones ADD COLUMN descripcion_adicional text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN sector_economico text NOT NULL DEFAULT '';
ALTER TABLE public.cotizaciones ADD COLUMN dimensiones_lcl jsonb NOT NULL DEFAULT '[]';
