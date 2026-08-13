CREATE TABLE IF NOT EXISTS public.proveedor_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  proveedor_id uuid NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  nombre text NOT NULL,
  archivo text NOT NULL,
  mime_type text,
  tamano_bytes bigint,
  fecha_documento date,
  fecha_vencimiento date,
  notas text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  CONSTRAINT proveedor_documentos_tipo_check CHECK (tipo IN (
    'Constancia de situación fiscal',
    'Opinión de cumplimiento',
    'Comprobante de datos bancarios',
    'Contrato',
    'Acta constitutiva',
    'Poder notarial',
    'Identificación oficial',
    'Otro'
  ))
);

CREATE INDEX IF NOT EXISTS idx_proveedor_documentos_proveedor
  ON public.proveedor_documentos (proveedor_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_proveedor_documentos_org
  ON public.proveedor_documentos (organization_id)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_documentos TO authenticated;
GRANT ALL ON public.proveedor_documentos TO service_role;

ALTER TABLE public.proveedor_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org puede ver documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Org puede ver documentos de proveedor"
ON public.proveedor_documentos FOR SELECT TO authenticated
USING (
  organization_id = public.current_user_org_id()
  OR public.has_role(auth.uid(), 'super_admin'::app_role)
);

DROP POLICY IF EXISTS "Compras puede insertar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede insertar documentos de proveedor"
ON public.proveedor_documentos FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.current_user_org_id()
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id = proveedor_id
      AND p.organization_id = public.current_user_org_id()
  )
);

DROP POLICY IF EXISTS "Compras puede actualizar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede actualizar documentos de proveedor"
ON public.proveedor_documentos FOR UPDATE TO authenticated
USING (organization_id = public.current_user_org_id())
WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS "Compras puede borrar documentos de proveedor" ON public.proveedor_documentos;
CREATE POLICY "Compras puede borrar documentos de proveedor"
ON public.proveedor_documentos FOR DELETE TO authenticated
USING (organization_id = public.current_user_org_id());

DROP TRIGGER IF EXISTS set_updated_at_proveedor_documentos ON public.proveedor_documentos;
CREATE TRIGGER set_updated_at_proveedor_documentos
BEFORE UPDATE ON public.proveedor_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage: carpeta proveedores/{proveedor_id}/... dentro del bucket privado 'documentos'
DROP POLICY IF EXISTS "Proveedor docs upload" ON storage.objects;
CREATE POLICY "Proveedor docs upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'proveedores'
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.organization_id = public.current_user_org_id()
  )
);

DROP POLICY IF EXISTS "Proveedor docs read" ON storage.objects;
CREATE POLICY "Proveedor docs read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'proveedores'
  AND EXISTS (
    SELECT 1 FROM public.proveedor_documentos d
    WHERE d.archivo = storage.objects.name
      AND d.organization_id = public.current_user_org_id()
  )
);

DROP POLICY IF EXISTS "Proveedor docs delete" ON storage.objects;
CREATE POLICY "Proveedor docs delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos'
  AND (storage.foldername(name))[1] = 'proveedores'
  AND EXISTS (
    SELECT 1 FROM public.proveedores p
    WHERE p.id::text = (storage.foldername(name))[2]
      AND p.organization_id = public.current_user_org_id()
  )
);