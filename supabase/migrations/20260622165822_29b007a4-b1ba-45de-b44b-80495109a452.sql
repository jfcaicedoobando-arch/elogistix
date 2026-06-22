ALTER TABLE public.proveedores
  ADD COLUMN IF NOT EXISTS banco_pais text,
  ADD COLUMN IF NOT EXISTS swift_bic text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS aba_routing text,
  ADD COLUMN IF NOT EXISTS banco_direccion text,
  ADD COLUMN IF NOT EXISTS banco_intermediario text,
  ADD COLUMN IF NOT EXISTS banco_intermediario_swift text,
  ADD COLUMN IF NOT EXISTS beneficiario text,
  ADD COLUMN IF NOT EXISTS referencia_pago text;