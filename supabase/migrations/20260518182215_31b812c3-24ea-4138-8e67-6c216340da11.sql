
ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_email text;

CREATE OR REPLACE FUNCTION public.set_embarque_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  IF (NEW.created_by_email IS NULL OR NEW.created_by_email = '') AND NEW.created_by IS NOT NULL THEN
    SELECT email INTO NEW.created_by_email FROM auth.users WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_embarque_created_by ON public.embarques;
CREATE TRIGGER trg_set_embarque_created_by
BEFORE INSERT ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.set_embarque_created_by();

-- Backfill from bitacora_actividad (accion='crear', modulo='embarques')
WITH primeros AS (
  SELECT DISTINCT ON (entidad_id) entidad_id, usuario_id, usuario_email
  FROM public.bitacora_actividad
  WHERE modulo = 'embarques' AND accion = 'crear' AND entidad_id IS NOT NULL
  ORDER BY entidad_id, created_at ASC
)
UPDATE public.embarques e
SET created_by = p.usuario_id,
    created_by_email = COALESCE(NULLIF(p.usuario_email, ''), e.created_by_email)
FROM primeros p
WHERE p.entidad_id = e.id
  AND e.created_by IS NULL;
