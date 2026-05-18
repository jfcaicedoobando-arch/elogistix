CREATE OR REPLACE FUNCTION public.can_manage_document_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, storage
AS $$
  WITH parts AS (
    SELECT storage.foldername(ltrim(_object_name, '/')) AS folder_parts
  ), actor AS (
    SELECT
      auth.uid() AS user_id,
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'super_admin'::public.app_role
      ) AS is_super_admin,
      EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin'::public.app_role, 'operador'::public.app_role)
      ) AS is_staff
  )
  SELECT COALESCE(
    (SELECT is_super_admin FROM actor)
    OR (
      (SELECT user_id FROM actor) IS NOT NULL
      AND (SELECT is_staff FROM actor)
      AND (SELECT folder_parts[1] FROM parts) = 'embarques'
      AND EXISTS (
        SELECT 1
        FROM public.organization_members om
        JOIN public.embarques e ON e.organization_id = om.organization_id
        CROSS JOIN parts
        CROSS JOIN actor
        WHERE om.user_id = actor.user_id
          AND om.role IN ('admin'::public.app_role, 'operador'::public.app_role)
          AND e.deleted_at IS NULL
          AND (
            parts.folder_parts[2] = e.expediente
            OR (
              parts.folder_parts[2] = e.id::text
              AND EXISTS (
                SELECT 1
                FROM public.documentos_embarque d
                WHERE d.id::text = parts.folder_parts[3]
                  AND d.embarque_id = e.id
                  AND d.organization_id = e.organization_id
                  AND d.deleted_at IS NULL
              )
            )
          )
      )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_document_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO anon;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO supabase_storage_admin;

DROP POLICY IF EXISTS "Admin/operador upload documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador delete documentos" ON storage.objects;

CREATE POLICY "Admin/operador upload documentos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'documentos'
  AND auth.uid() IS NOT NULL
  AND public.can_manage_document_object(name)
);

CREATE POLICY "Admin/operador update documentos"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'documentos'
  AND auth.uid() IS NOT NULL
  AND public.can_manage_document_object(name)
)
WITH CHECK (
  bucket_id = 'documentos'
  AND auth.uid() IS NOT NULL
  AND public.can_manage_document_object(name)
);

CREATE POLICY "Admin/operador delete documentos"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'documentos'
  AND auth.uid() IS NOT NULL
  AND public.can_manage_document_object(name)
);