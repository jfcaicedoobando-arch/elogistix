-- Recrear el índice único como parcial, ignorando facturas soft-deleted.
ALTER TABLE public.proveedor_facturas
  DROP CONSTRAINT IF EXISTS proveedor_facturas_organization_id_proveedor_id_folio_prove_key;

DROP INDEX IF EXISTS public.proveedor_facturas_organization_id_proveedor_id_folio_prove_key;

CREATE UNIQUE INDEX proveedor_facturas_org_prov_folio_uq
  ON public.proveedor_facturas (organization_id, proveedor_id, folio_proveedor)
  WHERE deleted_at IS NULL;