-- Bug fix 13.114.14: permitir al rol `contador` subir/actualizar archivos CFDI
-- en el bucket `facturas`. La política original sólo incluía admin/operador/super_admin
-- y dejaba a los contadores (quienes capturan facturas de proveedor) viendo
-- el toast "Factura guardada pero el XML/PDF falló".
DROP POLICY IF EXISTS "Org staff upload facturas" ON storage.objects;
CREATE POLICY "Org staff upload facturas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Org staff update facturas" ON storage.objects;
CREATE POLICY "Org staff update facturas"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'facturas'
  AND (storage.foldername(name))[1] = current_user_org_id()::text
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'contador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);