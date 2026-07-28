-- FIX B-085 · Storage cartas garantía con filtro de organización
DROP POLICY IF EXISTS "Agente carta garantia access" ON storage.objects;
CREATE POLICY "Agente carta garantia access"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'agente-cartas-garantia'
    AND (
      EXISTS (
        SELECT 1
          FROM public.organization_members om
          JOIN public.costeo_agentes a
            ON a.organization_id = om.organization_id
         WHERE om.user_id = auth.uid()
           AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador')
           AND a.id::text = (storage.foldername(name))[1]
      )
      OR (
        public.has_role(auth.uid(), 'agente_carga')
        AND (storage.foldername(name))[1] = public.current_agente_id()::text
      )
    )
  )
  WITH CHECK (
    bucket_id = 'agente-cartas-garantia'
    AND (
      EXISTS (
        SELECT 1
          FROM public.organization_members om
          JOIN public.costeo_agentes a
            ON a.organization_id = om.organization_id
         WHERE om.user_id = auth.uid()
           AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador')
           AND a.id::text = (storage.foldername(name))[1]
      )
      OR (
        public.has_role(auth.uid(), 'agente_carga')
        AND (storage.foldername(name))[1] = public.current_agente_id()::text
      )
    )
  );

-- FIX B-098 · current_agente_* deterministas
CREATE OR REPLACE FUNCTION public.current_agente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT agente_id FROM public.agente_users
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC, id ASC
   LIMIT 1
$$;

COMMENT ON FUNCTION public.current_agente_id() IS
  'Agente efectivo del usuario autenticado. Regla de desempate (B-098): el vínculo más antiguo de agente_users (created_at ASC, id ASC).';

CREATE OR REPLACE FUNCTION public.current_agente_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.agente_users
   WHERE user_id = auth.uid()
   ORDER BY created_at ASC, id ASC
   LIMIT 1
$$;

COMMENT ON FUNCTION public.current_agente_org() IS
  'Organización del agente efectivo del usuario autenticado. Mismo desempate determinista que current_agente_id (B-098).';

CREATE OR REPLACE FUNCTION public.get_current_agente_context()
RETURNS TABLE (
  agente_id uuid,
  organization_id uuid,
  proveedor_id uuid,
  agente_nombre text,
  organizacion_nombre text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT au.agente_id,
         au.organization_id,
         ca.proveedor_id,
         ca.nombre,
         o.nombre
    FROM public.agente_users au
    LEFT JOIN public.costeo_agentes ca ON ca.id = au.agente_id
    LEFT JOIN public.organizations  o  ON o.id  = au.organization_id
   WHERE au.user_id = auth.uid()
   ORDER BY au.created_at ASC, au.id ASC
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.current_agente_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_agente_org() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_agente_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_agente_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_agente_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_agente_context() TO authenticated;