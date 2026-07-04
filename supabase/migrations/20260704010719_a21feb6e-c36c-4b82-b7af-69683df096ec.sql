-- v13.171.0: facturas.tipo_cambio ahora es nullable con default NULL.
-- Facturas en moneda extranjera nacen sin TC para forzar al usuario a
-- capturarlo con "Obtener TC DOF de hoy" antes de timbrar.

ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_tipo_cambio_pos;
ALTER TABLE public.facturas ALTER COLUMN tipo_cambio DROP NOT NULL;
ALTER TABLE public.facturas ALTER COLUMN tipo_cambio DROP DEFAULT;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_tipo_cambio_pos
  CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);