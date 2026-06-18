UPDATE public.bitacora_actividad ba
SET entidad_id = e.id
FROM public.embarques e
WHERE ba.modulo = 'embarques'
  AND ba.entidad_id IS NULL
  AND ba.entidad_nombre IS NOT NULL
  AND e.expediente = ba.entidad_nombre
  AND e.organization_id = ba.organization_id;