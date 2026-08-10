ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_rfc_formato;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_rfc_formato
  CHECK (
    rfc IS NULL
    OR rfc = ''
    OR rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
  ) NOT VALID;