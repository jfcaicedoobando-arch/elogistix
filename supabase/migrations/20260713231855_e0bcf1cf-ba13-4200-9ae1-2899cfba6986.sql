ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS lcl_tarifa_wm numeric(12,2),
  ADD COLUMN IF NOT EXISTS lcl_minimo_flete numeric(12,2),
  ADD COLUMN IF NOT EXISTS lcl_dias_libres_almacenaje integer,
  ADD COLUMN IF NOT EXISTS lcl_consolidador_id uuid REFERENCES public.proveedores(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.cotizaciones.lcl_tarifa_wm IS 'LCL: tarifa USD por W/M (weight or measure) cuando no hay tarifa marítima vinculada.';
COMMENT ON COLUMN public.cotizaciones.lcl_minimo_flete IS 'LCL: mínimo de flete en USD (piso aplicado al cálculo W/M × tarifa).';
COMMENT ON COLUMN public.cotizaciones.lcl_dias_libres_almacenaje IS 'LCL: días libres de almacenaje en destino (captura manual cuando no hay tarifa).';
COMMENT ON COLUMN public.cotizaciones.lcl_consolidador_id IS 'LCL: proveedor consolidador/agente cuando se captura flete manual.';