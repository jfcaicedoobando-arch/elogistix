-- 13.149.0 — Envío branded de facturas por email (homologación con cotizaciones/proformas).

-- 1. RLS del bucket privado `facturas-pdf`. Path esperado:
--    {organization_id}/{factura_id}/{numero}-{timestamp}.{pdf|xml}
CREATE POLICY "facturas_pdf_select_org_members"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'facturas-pdf'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = split_part(name, '/', 1)
    )
  );

-- 2. Tabla de trazabilidad de envíos por correo (destinatarios/CC/estado).
CREATE TABLE IF NOT EXISTS public.factura_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id uuid NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc jsonb NOT NULL DEFAULT '[]'::jsonb,
  asunto text,
  mensaje text,
  pdf_storage_path text,
  xml_storage_path text,
  pdf_link_publico text,
  xml_link_publico text,
  estado text NOT NULL DEFAULT 'enviado',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_envios TO authenticated;
GRANT ALL ON public.factura_envios TO service_role;

ALTER TABLE public.factura_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros org leen envíos de factura de su org"
  ON public.factura_envios FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = factura_envios.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE POLICY "Miembros org crean envíos de factura de su org"
  ON public.factura_envios FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = factura_envios.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_factura_envios_fac_created
  ON public.factura_envios (factura_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_factura_envios_org
  ON public.factura_envios (organization_id);