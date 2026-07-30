-- Políticas de storage para el bucket privado `cxp-inbox`.
-- Convención de ruta: {organization_id}/{embarque_id}/{hash}-{archivo}
DROP POLICY IF EXISTS "cxp_inbox_select_org" ON storage.objects;
CREATE POLICY "cxp_inbox_select_org" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cxp-inbox'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR (storage.foldername(name))[1] = (public.current_user_org_id())::text
  )
);

DROP POLICY IF EXISTS "cxp_inbox_insert_org" ON storage.objects;
CREATE POLICY "cxp_inbox_insert_org" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cxp-inbox'
  AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'contador')
    OR public.has_role(auth.uid(), 'auxiliar_contable')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);

DROP POLICY IF EXISTS "cxp_inbox_delete_org" ON storage.objects;
CREATE POLICY "cxp_inbox_delete_org" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cxp-inbox'
  AND (storage.foldername(name))[1] = (public.current_user_org_id())::text
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'super_admin')
  )
);