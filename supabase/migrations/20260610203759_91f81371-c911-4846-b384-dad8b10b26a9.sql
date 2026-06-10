CREATE UNIQUE INDEX IF NOT EXISTS proveedores_org_rfc_unique
  ON public.proveedores (organization_id, upper(btrim(rfc)))
  WHERE rfc IS NOT NULL
    AND btrim(rfc) <> ''
    AND upper(btrim(rfc)) NOT IN ('XEXX010101000', 'XAXX010101000');