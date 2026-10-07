-- Sólo lectura: diferencias prospectivas del indicador, sin reparar ni tocar historial.
-- Ejecutar únicamente en un contexto de consulta autorizado. Respeta RLS del llamante.
-- Para una organización concreta, añadir WHERE e.organization_id = :organization_id
-- dentro de la CTE. La regla se replica literalmente del helper canónico.
WITH estado AS (
  SELECT e.id AS embarque_id, e.organization_id, e.tiene_proforma AS almacenado,
         EXISTS (
    SELECT 1 FROM public.proformas p
    WHERE p.embarque_id = e.id
      AND p.deleted_at IS NULL
      AND COALESCE(p.estado_proforma, 'pendiente') <> 'cancelada'
      AND COALESCE(p.estado_cliente, 'pendiente') <> 'rechazada'
      AND COALESCE(p.estado_revision, 'aprobada') <> 'consolidada'
      AND p.consolidada_en IS NULL
      AND (
        p.estado_proforma = 'facturada'
        OR COALESCE(p.estado_aprobacion, 'aprobada') <> 'borrador'
        OR EXISTS (
          SELECT 1 FROM public.conceptos_venta cv
          WHERE cv.proforma_id = p.id AND cv.deleted_at IS NULL
        )
      )
  ) AS esperado
  FROM public.embarques e
)
SELECT embarque_id, organization_id, almacenado, esperado
FROM estado WHERE almacenado IS DISTINCT FROM esperado
ORDER BY organization_id, embarque_id;
