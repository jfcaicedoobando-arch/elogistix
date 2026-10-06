-- Replay de Drizzle 0004; los predicados de acceso se mantienen idénticos.
-- Bucket observado en Lovable: privado, máximo 10 MiB, MIME sin restricción.
-- No modifica objetos existentes ni sobrescribe la configuración de un bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('crm-pricing-adjuntos', 'crm-pricing-adjuntos', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- Adjuntos de Solicitudes a Pricing (bucket privado crm-pricing-adjuntos).
-- Ruta: {organization_id}/{solicitud_id}/{archivo}. La tenencia se valida con
-- EXISTS contra la solicitud (misma org activa); nunca sólo por el path.

DROP POLICY IF EXISTS crm_pricing_adjuntos_leer ON storage.objects;
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

DROP POLICY IF EXISTS crm_pricing_adjuntos_subir ON storage.objects;
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
