-- v13.823.59 · Sello del backfill legacy coherente en AMBOS datos.
--
-- La rutina de v13.823.58 sólo corregía el sello cuando `version_aceptada`
-- difería del snapshot elegido; si el número ya coincidía pero `aceptada_en`
-- venía de `updated_at` (v13.823.57), la foto quedaba etiquetada con la fecha
-- de otra. Aquí se corrige cuando difiere CUALQUIERA de los dos datos, y
-- ambos se toman del MISMO último snapshot (selección determinista).
--
-- Alcance: sólo cotizaciones referidas por auditorías `oportunidad_ganada_backfill`
-- con `fuente_monto = 'snapshot_mas_reciente'` y que nunca fueron aceptadas por
-- un usuario real (`aceptada_por IS NULL`): esa es la protección que evita
-- pisar aceptaciones ajenas o posteriores. Nunca se usa el subtotal vivo.
--
-- Preflight read-only ejecutado antes de esta migración:
--   filas_afectadas = 0 (no hay sellos incoherentes en datos vivos).
-- La migración es idempotente y segura en un replay limpio.
WITH objetivo AS (
  SELECT c.id            AS cot_id,
         c.organization_id,
         o.op_id,
         s.version_num,
         s.created_at
    FROM (
      SELECT DISTINCT
             b.organization_id,
             b.entidad_id AS op_id,
             (b.detalles -> 'after' ->> 'cotizacion_ganadora_id')::uuid AS cot_id
        FROM public.bitacora_actividad b
       WHERE b.accion = 'oportunidad_ganada_backfill'
         AND b.detalles ->> 'fuente_monto' = 'snapshot_mas_reciente'
         AND (b.detalles -> 'after' ->> 'cotizacion_ganadora_id') IS NOT NULL
    ) o
    JOIN public.cotizaciones c
      ON c.id = o.cot_id
     AND c.organization_id = o.organization_id
    JOIN LATERAL (
      SELECT v.version_num, v.created_at
        FROM public.cotizacion_versiones v
       WHERE v.cotizacion_id = c.id
       ORDER BY v.version_num DESC, v.created_at DESC
       LIMIT 1
    ) s ON true
   WHERE c.aceptada_por IS NULL
     AND (c.version_aceptada IS DISTINCT FROM s.version_num
          OR c.aceptada_en    IS DISTINCT FROM s.created_at)
), corregidas AS (
  UPDATE public.cotizaciones c
     SET version_aceptada = o.version_num,
         aceptada_en      = o.created_at,
         updated_at       = now()
    FROM objetivo o
   WHERE c.id = o.cot_id
     AND c.organization_id = o.organization_id
  RETURNING c.id AS cot_id, c.organization_id, o.op_id, o.version_num, o.created_at
)
INSERT INTO public.bitacora_actividad (
  organization_id, modulo, accion, entidad_id, entidad_nombre,
  usuario_id, usuario_email, detalles
)
SELECT k.organization_id, 'crm', 'oportunidad_ganada_backfill_sello_coherente',
       k.op_id, '', NULL, '',
       jsonb_build_object('cotizacion_id', k.cot_id,
                          'version_aceptada', k.version_num,
                          'aceptada_en', k.created_at,
                          'fuente', 'snapshot_mas_reciente')
  FROM corregidas k;