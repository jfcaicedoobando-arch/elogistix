
DROP POLICY IF EXISTS "Agente carta garantia access" ON storage.objects;
CREATE POLICY "Agente carta garantia access"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'agente-cartas-garantia'
    AND (
      EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador')
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
        SELECT 1 FROM public.organization_members om
        WHERE om.user_id = auth.uid()
          AND om.role IN ('admin','admin_org','gerente_operaciones','coordinador_logistico','ejecutivo_pricing','operador')
      )
      OR (
        public.has_role(auth.uid(), 'agente_carga')
        AND (storage.foldername(name))[1] = public.current_agente_id()::text
      )
    )
  );
