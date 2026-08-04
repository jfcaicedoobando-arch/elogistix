-- Permite reemplazar (upsert) archivos del buzón CxP: misma organización + roles de escritura
DROP POLICY IF EXISTS "cxp_inbox_update_org" ON storage.objects;
CREATE POLICY "cxp_inbox_update_org"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cxp-inbox'
  AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'operador'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
    OR public.has_role(auth.uid(), 'auxiliar_contable'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
)
WITH CHECK (
  bucket_id = 'cxp-inbox'
  AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'operador'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
    OR public.has_role(auth.uid(), 'auxiliar_contable'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);

-- Alinea el borrado con la inserción: contabilidad también puede retirar su archivo del buzón
DROP POLICY IF EXISTS "cxp_inbox_delete_org" ON storage.objects;
CREATE POLICY "cxp_inbox_delete_org"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'cxp-inbox'
  AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'operador'::public.app_role)
    OR public.has_role(auth.uid(), 'contador'::public.app_role)
    OR public.has_role(auth.uid(), 'auxiliar_contable'::public.app_role)
    OR public.has_role(auth.uid(), 'super_admin'::public.app_role)
  )
);