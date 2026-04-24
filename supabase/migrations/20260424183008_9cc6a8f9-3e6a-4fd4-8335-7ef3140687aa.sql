-- 1. Add columns to facturas
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS proforma_id uuid REFERENCES public.proformas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS factura_pdf_url text,
  ADD COLUMN IF NOT EXISTS factura_xml_url text;

CREATE INDEX IF NOT EXISTS idx_facturas_proforma_id ON public.facturas(proforma_id);

-- 2. Add column to proformas
ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS factura_id uuid REFERENCES public.facturas(id) ON DELETE SET NULL;

-- 3. Create storage bucket facturas (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('facturas', 'facturas', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage policies for facturas bucket
DROP POLICY IF EXISTS "Public read facturas" ON storage.objects;
CREATE POLICY "Public read facturas"
ON storage.objects FOR SELECT
USING (bucket_id = 'facturas');

DROP POLICY IF EXISTS "Authenticated upload facturas" ON storage.objects;
CREATE POLICY "Authenticated upload facturas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'facturas');

DROP POLICY IF EXISTS "Authenticated update facturas" ON storage.objects;
CREATE POLICY "Authenticated update facturas"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'facturas');

DROP POLICY IF EXISTS "Authenticated delete facturas" ON storage.objects;
CREATE POLICY "Authenticated delete facturas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'facturas');