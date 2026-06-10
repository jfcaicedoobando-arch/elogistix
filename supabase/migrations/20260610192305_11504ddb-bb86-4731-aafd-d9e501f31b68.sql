ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS cp text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS regimen_fiscal text;