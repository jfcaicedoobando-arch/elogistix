CREATE OR REPLACE FUNCTION public.can_manage_document_object(_object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH parts AS (
    SELECT storage.foldername(ltrim(_object_name, '/')) AS folder_parts
  ), actor AS (
    SELECT
      auth.uid() AS user_id,
      public.has_role(auth.uid(), 'super_admin'::public.app_role) AS is_super_admin,
      public.has_role(auth.uid(), 'operador'::public.app_role) AS is_staff
  )
  SELECT COALESCE(
    (SELECT is_super_admin FROM actor)
    OR (
      (SELECT user_id FROM actor) IS NOT NULL
      AND (SELECT is_staff FROM actor)
      AND (SELECT folder_parts[1] FROM parts) = 'embarques'
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.embarques e ON e.organization_id = om.organization_id
        CROSS JOIN parts CROSS JOIN actor
        WHERE om.user_id = actor.user_id
          AND public.has_role(om.user_id, 'operador'::public.app_role)
          AND e.deleted_at IS NULL
          AND (
            parts.folder_parts[2] = e.expediente
            OR (
              parts.folder_parts[2] = e.id::text
              AND EXISTS (
                SELECT 1 FROM public.documentos_embarque d
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
$function$;