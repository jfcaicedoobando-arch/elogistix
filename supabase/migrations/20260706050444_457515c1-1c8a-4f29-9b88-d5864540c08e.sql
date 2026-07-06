
ALTER TABLE public.proveedor_facturas
  ADD COLUMN IF NOT EXISTS uuid_verificado BOOLEAN,
  ADD COLUMN IF NOT EXISTS uuid_verificado_fecha TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uuid_estatus_sat TEXT;

COMMENT ON COLUMN public.proveedor_facturas.uuid_estatus_sat IS 'Estatus SAT: Vigente | Cancelado | No Encontrado | Error';
