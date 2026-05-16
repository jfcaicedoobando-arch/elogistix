
-- 1) Documentos bucket: scope writes to the user's organization folder
DROP POLICY IF EXISTS "Admin/operador upload documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador delete documentos" ON storage.objects;

CREATE POLICY "Admin/operador upload documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  AND (storage.foldername(name))[1] = current_user_org_id()::text
);

CREATE POLICY "Admin/operador update documentos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  AND (storage.foldername(name))[1] = current_user_org_id()::text
)
WITH CHECK (
  bucket_id = 'documentos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  AND (storage.foldername(name))[1] = current_user_org_id()::text
);

CREATE POLICY "Admin/operador delete documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operador'::app_role))
  AND (storage.foldername(name))[1] = current_user_org_id()::text
);

-- 2) user_roles: restrict admin SELECT to same-org members
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR has_role(auth.uid(), 'super_admin'::app_role)
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.organization_members om_self
      JOIN public.organization_members om_target
        ON om_target.organization_id = om_self.organization_id
      WHERE om_self.user_id = auth.uid()
        AND om_target.user_id = user_roles.user_id
    )
  )
);
