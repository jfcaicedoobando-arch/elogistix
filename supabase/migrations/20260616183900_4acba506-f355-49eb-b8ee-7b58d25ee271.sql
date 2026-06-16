-- 1. Agregar fecha_envio a cotizaciones
ALTER TABLE public.cotizaciones
  ADD COLUMN IF NOT EXISTS fecha_envio timestamptz;

-- 2. Tabla de historial de envíos por correo
CREATE TABLE IF NOT EXISTS public.cotizacion_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  enviado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  destinatarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc jsonb NOT NULL DEFAULT '[]'::jsonb,
  asunto text,
  mensaje text,
  pdf_storage_path text,
  pdf_link_publico text,
  estado text NOT NULL DEFAULT 'enviado',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cotizacion_envios TO authenticated;
GRANT ALL ON public.cotizacion_envios TO service_role;

ALTER TABLE public.cotizacion_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Miembros org leen envíos de su org"
  ON public.cotizacion_envios FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = cotizacion_envios.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE POLICY "Miembros org crean envíos de su org"
  ON public.cotizacion_envios FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = cotizacion_envios.organization_id
      AND om.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_cotizacion_envios_cot_created
  ON public.cotizacion_envios (cotizacion_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cotizacion_envios_org
  ON public.cotizacion_envios (organization_id);

-- 3. RLS para bucket cotizaciones-pdf
-- Path esperado: {organization_id}/{cotizacion_id}/{folio}-{timestamp}.pdf
CREATE POLICY "cotizaciones_pdf_select_org_members"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'cotizaciones-pdf'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "cotizaciones_pdf_insert_org_members"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cotizaciones-pdf'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "cotizaciones_pdf_delete_org_members"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cotizaciones-pdf'
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id::text = (storage.foldername(name))[1]
    )
  );