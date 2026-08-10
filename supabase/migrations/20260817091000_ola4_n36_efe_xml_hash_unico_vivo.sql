-- Ola 4 · N36: el XML del buzón CxP nunca se deduplicaba. El archivo
-- principal ya está cubierto por uq_efe_org_hash_vivo (20260730014349);
-- falta la misma garantía para xml_hash (XML acompañante o adjunto tardío
-- vía adjuntarXmlFacturaEntrante).

-- ============================================================
-- PASO PREVIO (manual, ejecutar y guardar evidencia ANTES de aplicar):
--
--   SELECT organization_id, xml_hash, count(*) AS n,
--          array_agg(id ORDER BY created_at) AS documento_ids
--     FROM public.embarque_facturas_entrantes
--    WHERE xml_hash IS NOT NULL AND deleted_at IS NULL
--    GROUP BY 1, 2
--   HAVING count(*) > 1;
--
-- Si devuelve filas, soft-eliminar los documentos sobrantes (conservar el
-- más antiguo) antes de crear el índice:
--
--   UPDATE public.embarque_facturas_entrantes
--      SET deleted_at = now()
--    WHERE id IN (<ids sobrantes del paso anterior>);
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_efe_org_xml_hash_vivo
  ON public.embarque_facturas_entrantes (organization_id, xml_hash)
  WHERE xml_hash IS NOT NULL AND deleted_at IS NULL;
