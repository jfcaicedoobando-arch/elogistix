ALTER TABLE public.conceptos_costo DROP CONSTRAINT IF EXISTS conceptos_costo_monto_nonneg;
ALTER TABLE public.conceptos_costo DROP CONSTRAINT IF EXISTS conceptos_costo_monto_signo;
ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_monto_signo CHECK (
    monto >= 0 OR origen = 'ajuste_factura_proveedor'
  );
COMMENT ON CONSTRAINT conceptos_costo_monto_signo ON public.conceptos_costo IS
  'v13.307.8: Los renglones normales exigen monto>=0. Los ajustes con origen=ajuste_factura_proveedor pueden ser negativos para reflejar descuentos del proveedor sobre lo devengado.';