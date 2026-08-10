DROP INDEX IF EXISTS public.uq_bbva_movimientos_pago_factura;
DROP INDEX IF EXISTS public.uq_bbva_movimientos_pago_proveedor;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bbva_movimientos_pago_factura
  ON public.bbva_movimientos (pago_factura_id)
  WHERE pago_factura_id IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bbva_movimientos_pago_proveedor
  ON public.bbva_movimientos (pago_proveedor_id)
  WHERE pago_proveedor_id IS NOT NULL AND deleted_at IS NULL;

UPDATE public.facturas f
   SET deleted_at = now()
  FROM public.proformas p
 WHERE f.proforma_id = p.id
   AND f.deleted_at IS NULL
   AND f.id IS DISTINCT FROM p.factura_id
   AND f.id IS DISTINCT FROM p.factura_secundaria_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_facturas_proforma_moneda_viva
  ON public.facturas (proforma_id, moneda)
  WHERE proforma_id IS NOT NULL AND deleted_at IS NULL;