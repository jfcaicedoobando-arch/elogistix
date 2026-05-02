-- Fase 2 Auditoría: Asignación de responsables y workflow de hallazgos.
-- Extiende auditoria_revisiones para soportar pre-asignación sin requerir acción cerrada,
-- y deja auditoría completa de quién tomó/asignó y cuándo.

-- 1. Estado de workflow de un hallazgo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_hallazgo_revision') THEN
    CREATE TYPE public.estado_hallazgo_revision AS ENUM (
      'pendiente',     -- registro creado sólo para asignar/limitar; sin acción aún
      'en_progreso',   -- responsable trabajando en él
      'revisado'       -- acción tomada, cerrado
    );
  END IF;
END$$;

-- 2. Nuevas columnas
ALTER TABLE public.auditoria_revisiones
  ADD COLUMN IF NOT EXISTS responsable_id uuid,
  ADD COLUMN IF NOT EXISTS responsable_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS asignado_por uuid,
  ADD COLUMN IF NOT EXISTS asignado_por_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS asignado_at timestamptz,
  ADD COLUMN IF NOT EXISTS fecha_limite date,
  ADD COLUMN IF NOT EXISTS estado_revision public.estado_hallazgo_revision NOT NULL DEFAULT 'pendiente';

-- 3. Permitir que accion_tomada y revisado_por sean opcionales para registros sólo-asignación
ALTER TABLE public.auditoria_revisiones
  ALTER COLUMN accion_tomada DROP NOT NULL,
  ALTER COLUMN accion_tomada DROP DEFAULT,
  ALTER COLUMN revisado_por DROP NOT NULL,
  ALTER COLUMN revisado_por DROP DEFAULT,
  ALTER COLUMN revisado_por_email DROP NOT NULL,
  ALTER COLUMN revisado_por_email DROP DEFAULT;

-- Reemplazar nulos heredados
UPDATE public.auditoria_revisiones
   SET estado_revision = 'revisado'
 WHERE revisado_por IS NOT NULL AND accion_tomada IS NOT NULL AND accion_tomada <> '';

-- 4. Índice para listar por responsable rápido
CREATE INDEX IF NOT EXISTS idx_auditoria_revisiones_responsable
  ON public.auditoria_revisiones (organization_id, responsable_id)
  WHERE responsable_id IS NOT NULL;

-- 5. Trigger para mantener updated_at consistente
CREATE OR REPLACE FUNCTION public.touch_auditoria_revisiones()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_auditoria_revisiones ON public.auditoria_revisiones;
CREATE TRIGGER trg_touch_auditoria_revisiones
  BEFORE UPDATE ON public.auditoria_revisiones
  FOR EACH ROW EXECUTE FUNCTION public.touch_auditoria_revisiones();