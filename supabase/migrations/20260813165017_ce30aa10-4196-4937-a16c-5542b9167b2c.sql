-- Ola 12 · Sprint 03 · R3P-13
-- La política "Proveedor docs read" de storage.objects no excluía documentos
-- con soft-delete: un archivo cuyo deleteFile falló tras el borrado lógico
-- seguía descargable por cualquier miembro de la organización (liga firmada).
-- Se recrea idempotente agregando `d.deleted_at IS NULL`.
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
      AND d.deleted_at IS NULL
  )
);