ALTER TABLE public.embarques
  ALTER COLUMN tipo_cambio_usd DROP NOT NULL,
  ALTER COLUMN tipo_cambio_eur DROP NOT NULL;