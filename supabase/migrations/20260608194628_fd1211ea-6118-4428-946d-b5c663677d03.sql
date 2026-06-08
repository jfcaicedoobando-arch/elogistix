CREATE UNIQUE INDEX IF NOT EXISTS ux_proveedor_facturas_uuid_fiscal_org
ON public.proveedor_facturas (organization_id, uuid_fiscal)
WHERE uuid_fiscal IS NOT NULL AND deleted_at IS NULL;