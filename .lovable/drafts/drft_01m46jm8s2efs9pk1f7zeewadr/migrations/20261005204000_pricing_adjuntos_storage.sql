-- Adjuntos de Solicitudes a Pricing (bucket privado crm-pricing-adjuntos).
-- Ruta: {organization_id}/{solicitud_id}/{archivo}. La tenencia se valida con
-- EXISTS contra la solicitud (misma org activa); nunca sólo por el path.

CREATE POLICY crm_pricing_adjuntos_leer ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'crm-pricing-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.crm_solicitudes_pricing s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND s.organization_id::text = (storage.foldername(name))[1]
        AND s.organization_id = public.org_scope()
    )
  );

CREATE POLICY crm_pricing_adjuntos_subir ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'crm-pricing-adjuntos'
    AND EXISTS (
      SELECT 1 FROM public.crm_solicitudes_pricing s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND s.organization_id::text = (storage.foldername(name))[1]
        AND s.organization_id = public.org_scope()
        AND s.estado <> 'cancelada'
    )
  );

-- Sólo quien subió el archivo puede quitarlo.
CREATE POLICY crm_pricing_adjuntos_borrar ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'crm-pricing-adjuntos'
    AND owner_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.crm_solicitudes_pricing s
      WHERE s.id::text = (storage.foldername(name))[2]
        AND s.organization_id = public.org_scope()
    )
  );
