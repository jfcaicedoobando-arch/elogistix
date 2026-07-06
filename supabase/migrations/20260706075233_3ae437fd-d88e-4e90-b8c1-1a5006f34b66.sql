
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS uuid_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uuid_estatus_sat text,
  ADD COLUMN IF NOT EXISTS uuid_verificado_fecha timestamp with time zone;

COMMENT ON COLUMN public.facturas.uuid_verificado IS
  'True si el UUID del CFDI ha sido verificado como Vigente en el web service público del SAT.';
COMMENT ON COLUMN public.facturas.uuid_estatus_sat IS
  'Última respuesta del SAT: Vigente | Cancelado | No Encontrado | Error.';
COMMENT ON COLUMN public.facturas.uuid_verificado_fecha IS
  'Timestamp de la última verificación contra el SAT.';
