-- R7-FIX3b: backfill residual de bitácora sin organization_id
UPDATE public.bitacora_actividad b
SET organization_id = m.organization_id
FROM public.organization_members m
WHERE b.organization_id IS NULL AND m.user_id = b.usuario_id;

UPDATE public.bitacora_actividad b
SET organization_id = e.organization_id
FROM public.embarques e
WHERE b.organization_id IS NULL AND b.entidad_id = e.id;

UPDATE public.bitacora_actividad b
SET organization_id = c.organization_id
FROM public.cotizaciones c
WHERE b.organization_id IS NULL AND b.entidad_id = c.id;

UPDATE public.bitacora_actividad b
SET organization_id = (
  SELECT organization_id FROM public.bitacora_actividad
  WHERE organization_id IS NOT NULL
  GROUP BY organization_id ORDER BY count(*) DESC LIMIT 1
)
WHERE b.organization_id IS NULL;