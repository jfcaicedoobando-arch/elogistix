ALTER TABLE public.embarques
  ADD COLUMN tipo_carga text NOT NULL DEFAULT 'Carga General',
  ADD COLUMN msds_archivo text DEFAULT NULL;