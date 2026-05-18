-- Fix: el path de los documentos del bucket "documentos" empieza con 'embarques/<expediente-o-id>/...',
-- no con '<org_id>/...'. La política anterior comparaba foldername[1] con current_user_org_id()
-- y por eso bloqueaba a operadores/admin con "new row violates row-level security policy".
-- Validamos pertenencia a la organización vía la tabla embarques.

DROP POLICY IF EXISTS "Admin/operador upload documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador update documentos" ON storage.objects;
DROP POLICY IF EXISTS "Admin/operador delete documentos" ON storage.objects;

CREATE POLICY "Admin/operador upload documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.organization_id = current_user_org_id()
        AND (
          (storage.foldername(name))[2] = e.expediente
          OR (storage.foldername(name))[2] = e.id::text
        )
    )
  )
);

CREATE POLICY "Admin/operador update documentos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.organization_id = current_user_org_id()
        AND (
          (storage.foldername(name))[2] = e.expediente
          OR (storage.foldername(name))[2] = e.id::text
        )
    )
  )
)
WITH CHECK (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.organization_id = current_user_org_id()
        AND (
          (storage.foldername(name))[2] = e.expediente
          OR (storage.foldername(name))[2] = e.id::text
        )
    )
  )
);

CREATE POLICY "Admin/operador delete documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'operador'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
  AND (
    has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.embarques e
      WHERE e.organization_id = current_user_org_id()
        AND (
          (storage.foldername(name))[2] = e.expediente
          OR (storage.foldername(name))[2] = e.id::text
        )
    )
  )
);