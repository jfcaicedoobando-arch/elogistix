
CREATE TABLE public.factura_recordatorios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  enviado_por UUID NOT NULL,
  canal TEXT NOT NULL DEFAULT 'correo',
  nota TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_factura_recordatorios_factura ON public.factura_recordatorios(factura_id, created_at DESC);
CREATE INDEX idx_factura_recordatorios_org ON public.factura_recordatorios(organization_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.factura_recordatorios TO authenticated;
GRANT ALL ON public.factura_recordatorios TO service_role;

ALTER TABLE public.factura_recordatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read recordatorios of their org"
  ON public.factura_recordatorios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = factura_recordatorios.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can insert recordatorios for their org facturas"
  ON public.factura_recordatorios FOR INSERT
  TO authenticated
  WITH CHECK (
    enviado_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.facturas f
      WHERE f.id = factura_recordatorios.factura_id
        AND f.organization_id = factura_recordatorios.organization_id
    )
    AND EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = factura_recordatorios.organization_id
        AND om.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update own recordatorios"
  ON public.factura_recordatorios FOR UPDATE
  TO authenticated
  USING (enviado_por = auth.uid())
  WITH CHECK (enviado_por = auth.uid());

CREATE POLICY "Members can delete own recordatorios"
  ON public.factura_recordatorios FOR DELETE
  TO authenticated
  USING (enviado_por = auth.uid());
