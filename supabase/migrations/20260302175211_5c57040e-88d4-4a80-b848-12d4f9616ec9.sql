ALTER TABLE public.cotizaciones ADD COLUMN tipo_carga text NOT NULL DEFAULT 'Carga General';
ALTER TABLE public.cotizaciones ADD COLUMN msds_archivo text;