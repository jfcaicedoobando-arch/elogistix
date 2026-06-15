-- Bloque 3 auditoría: agregar revisado_at para medir MTTR real
-- (no usar updated_at, que cambia con cualquier update — comentarios, snooze, etc.)

ALTER TABLE public.auditoria_revisiones
  ADD COLUMN IF NOT EXISTS revisado_at timestamptz;

-- Trigger: setea revisado_at cuando la fila pasa a estado_revision='revisado'.
-- Si vuelve a otro estado, deja revisado_at intacto (auditable).
CREATE OR REPLACE FUNCTION public.set_auditoria_revisado_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.estado_revision = 'revisado' AND (OLD.estado_revision IS DISTINCT FROM 'revisado') THEN
    NEW.revisado_at = COALESCE(NEW.revisado_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_revisado_at ON public.auditoria_revisiones;
CREATE TRIGGER trg_set_revisado_at
BEFORE INSERT OR UPDATE OF estado_revision ON public.auditoria_revisiones
FOR EACH ROW EXECUTE FUNCTION public.set_auditoria_revisado_at();

-- Backfill histórico: filas ya revisadas usan updated_at como mejor aproximación.
UPDATE public.auditoria_revisiones
SET revisado_at = updated_at
WHERE estado_revision = 'revisado' AND revisado_at IS NULL;