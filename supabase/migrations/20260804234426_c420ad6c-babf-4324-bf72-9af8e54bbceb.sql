-- FIX Sentry JAVASCRIPT-REACT-4M: el bucket `documentos` sólo aceptaba
-- rutas `embarques/{expediente|id}/…` de embarques YA existentes, por lo que
-- fallaban: (a) MSDS de embarque, (b) MSDS de cotización y (c) los documentos
-- del alta de embarque (se suben antes de crear la fila). Se agrega una rama
-- por carpeta de organización, que conserva el aislamiento multi-tenant.
CREATE OR REPLACE FUNCTION public.can_manage_document_object(_object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH parts AS (
    SELECT storage.foldername(ltrim(_object_name, '/')) AS folder_parts
  ), actor AS (
    SELECT
      auth.uid() AS user_id,
      public.has_role(auth.uid(), 'super_admin'::public.app_role) AS is_super_admin,
      public.has_role(auth.uid(), 'operador'::public.app_role) AS is_staff,
      public.current_user_org_id() AS org_id
  )
  SELECT COALESCE(
    (SELECT is_super_admin FROM actor)
    OR (
      -- Rama nueva: carpeta raíz = organización efectiva del usuario.
      (SELECT user_id FROM actor) IS NOT NULL
      AND (SELECT is_staff FROM actor)
      AND (SELECT org_id FROM actor) IS NOT NULL
      AND (SELECT folder_parts[1] FROM parts) = (SELECT org_id::text FROM actor)
      AND (SELECT folder_parts[2] FROM parts) IN ('embarques', 'msds', 'cotizaciones')
    )
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

REVOKE ALL ON FUNCTION public.can_manage_document_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_document_object(text) TO authenticated, service_role;

-- Lectura: además de la validación por fila de `documentos_embarque`, permitir
-- leer los objetos de la propia carpeta de organización (MSDS, adjuntos).
DROP POLICY IF EXISTS "Org folder read documentos" ON storage.objects;
CREATE POLICY "Org folder read documentos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND public.can_manage_document_object(name)
);

-- FIX Sentry JAVASCRIPT-REACT-1G: dos ejecuciones simultáneas de `demo-access`
-- se cruzaban (una insertaba pagos mientras la otra borraba facturas) y
-- rompían la FK `pagos_proveedor_proveedor_factura_id_fkey`. Serializamos.
CREATE OR REPLACE FUNCTION public.seed_demo_organization()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- M8: sólo service_role (edge `demo-access`) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- Candado de transacción: un solo re-sembrado a la vez.
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  PERFORM public.seed_demo_organization_core();
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO authenticated, service_role;