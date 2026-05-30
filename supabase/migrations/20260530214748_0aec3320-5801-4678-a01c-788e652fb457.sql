-- Permite a usuarios con rol 'cliente' descargar archivos PDF/XML de sus
-- propias facturas. Path estructura: {org_id}/{factura_id}/factura.{pdf,xml}.
-- Validamos contra la tabla `facturas` (Storage RLS Paths) en lugar de
-- confiar en foldername[].
CREATE POLICY "Cliente read own factura files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'facturas'
  AND has_role(auth.uid(), 'cliente'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.facturas f
    WHERE f.id::text = (storage.foldername(name))[2]
      AND f.cliente_id IN (SELECT current_user_client_ids())
  )
);