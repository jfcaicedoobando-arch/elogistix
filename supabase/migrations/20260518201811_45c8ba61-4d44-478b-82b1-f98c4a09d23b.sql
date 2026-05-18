DROP POLICY IF EXISTS "Admin/operador upload documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador delete documentos" ON storage.objects;

CREATE POLICY "Admin/operador upload documentos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.embarques e
      WHERE e.organization_id = public.current_user_org_id()
        AND (
          (storage.foldername(storage.objects.name))[2] = e.expediente
          OR (storage.foldername(storage.objects.name))[2] = e.id::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.documentos_embarque d
      JOIN public.embarques e ON e.id = d.embarque_id
      WHERE d.organization_id = public.current_user_org_id()
        AND e.organization_id = public.current_user_org_id()
        AND (storage.foldername(storage.objects.name))[2] = e.id::text
        AND (storage.foldername(storage.objects.name))[3] = d.id::text
    )
  )
);

CREATE POLICY "Admin/operador update documentos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.embarques e
      WHERE e.organization_id = public.current_user_org_id()
        AND (
          (storage.foldername(storage.objects.name))[2] = e.expediente
          OR (storage.foldername(storage.objects.name))[2] = e.id::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.documentos_embarque d
      JOIN public.embarques e ON e.id = d.embarque_id
      WHERE d.organization_id = public.current_user_org_id()
        AND e.organization_id = public.current_user_org_id()
        AND (storage.foldername(storage.objects.name))[2] = e.id::text
        AND (storage.foldername(storage.objects.name))[3] = d.id::text
    )
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.embarques e
      WHERE e.organization_id = public.current_user_org_id()
        AND (
          (storage.foldername(storage.objects.name))[2] = e.expediente
          OR (storage.foldername(storage.objects.name))[2] = e.id::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.documentos_embarque d
      JOIN public.embarques e ON e.id = d.embarque_id
      WHERE d.organization_id = public.current_user_org_id()
        AND e.organization_id = public.current_user_org_id()
        AND (storage.foldername(storage.objects.name))[2] = e.id::text
        AND (storage.foldername(storage.objects.name))[3] = d.id::text
    )
  )
);

CREATE POLICY "Admin/operador delete documentos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'operador')
    OR public.has_role(auth.uid(), 'super_admin')
  )
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1
      FROM public.embarques e
      WHERE e.organization_id = public.current_user_org_id()
        AND (
          (storage.foldername(storage.objects.name))[2] = e.expediente
          OR (storage.foldername(storage.objects.name))[2] = e.id::text
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.documentos_embarque d
      JOIN public.embarques e ON e.id = d.embarque_id
      WHERE d.organization_id = public.current_user_org_id()
        AND e.organization_id = public.current_user_org_id()
        AND (storage.foldername(storage.objects.name))[2] = e.id::text
        AND (storage.foldername(storage.objects.name))[3] = d.id::text
    )
  )
);