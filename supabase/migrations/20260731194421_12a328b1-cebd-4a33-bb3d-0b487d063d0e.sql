-- FIX-H04 (P1-2): alinear el índice único de folio de proveedor con la
-- semántica de la app (proveedor + folio + fecha de emisión), excluyendo
-- facturas canceladas y borradas.
DROP INDEX IF EXISTS public.proveedor_facturas_org_prov_folio_uq;

CREATE UNIQUE INDEX IF NOT EXISTS proveedor_facturas_org_prov_folio_uq
  ON public.proveedor_facturas (organization_id, proveedor_id, folio_proveedor, fecha_emision)
  WHERE deleted_at IS NULL AND estado <> 'Cancelada'::estado_proveedor_factura;