-- ============================================================
-- M6 (auditoría arquitectura 2026-07-29) · Soft-delete en tablas de dinero
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'proveedores',
    'comisiones_devengadas',
    'liquidaciones_comision',
    'bbva_movimientos',
    'embarque_garantias_contenedor'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON public.%I(deleted_at) WHERE deleted_at IS NOT NULL', t, t);
  END LOOP;
END $$;

-- El índice único de RFC debe ignorar proveedores en papelera (igual que clientes).
DROP INDEX IF EXISTS public.proveedores_org_rfc_unique;
CREATE UNIQUE INDEX IF NOT EXISTS proveedores_org_rfc_unique
  ON public.proveedores (organization_id, upper(btrim(rfc)))
  WHERE rfc IS NOT NULL
    AND btrim(rfc) <> ''
    AND upper(btrim(rfc)) NOT IN ('XEXX010101000', 'XAXX010101000')
    AND deleted_at IS NULL;