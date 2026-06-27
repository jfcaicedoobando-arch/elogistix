
-- =============================================================================
-- Auditoría — Fase 3: workflow & notificaciones
-- =============================================================================

-- 1) Trigger: validar snooze (máximo 30 días salvo motivo robusto >= 20 chars)
CREATE OR REPLACE FUNCTION public.validar_snooze_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_dias int;
BEGIN
  IF NEW.snoozed_until IS NULL THEN
    RETURN NEW;
  END IF;

  v_dias := (NEW.snoozed_until - CURRENT_DATE);

  IF v_dias < 0 THEN
    RAISE EXCEPTION 'No se puede silenciar un hallazgo en el pasado (snoozed_until=%).', NEW.snoozed_until
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_dias > 30 AND COALESCE(length(trim(NEW.snooze_motivo)), 0) < 20 THEN
    RAISE EXCEPTION 'Snooze mayor a 30 días requiere motivo justificado (al menos 20 caracteres). Días=% , motivo=%',
      v_dias, COALESCE(length(trim(NEW.snooze_motivo)), 0)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_snooze_auditoria ON public.auditoria_revisiones;
CREATE TRIGGER trg_validar_snooze_auditoria
  BEFORE INSERT OR UPDATE OF snoozed_until, snooze_motivo
  ON public.auditoria_revisiones
  FOR EACH ROW EXECUTE FUNCTION public.validar_snooze_auditoria();


-- 2) Trigger: notificar al responsable cuando se le asigna/reasigna un hallazgo
CREATE OR REPLACE FUNCTION public.notificar_asignacion_hallazgo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo  text;
  v_msg     text;
  v_changed boolean;
BEGIN
  -- ¿Cambió el responsable a alguien distinto a quien asigna?
  IF TG_OP = 'INSERT' THEN
    v_changed := NEW.responsable_id IS NOT NULL
                 AND NEW.responsable_id <> COALESCE(NEW.asignado_por, '00000000-0000-0000-0000-000000000000'::uuid);
  ELSE
    v_changed := NEW.responsable_id IS NOT NULL
                 AND NEW.responsable_id IS DISTINCT FROM OLD.responsable_id
                 AND NEW.responsable_id <> COALESCE(NEW.asignado_por, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  v_titulo := 'Nuevo hallazgo asignado';
  v_msg := format(
    'Te asignaron un hallazgo (%s) en el embarque. %s',
    NEW.regla,
    CASE WHEN NEW.fecha_limite IS NOT NULL
         THEN 'Fecha límite: ' || to_char(NEW.fecha_limite, 'DD/MM/YYYY') || '.'
         ELSE '' END
  );

  INSERT INTO public.notificaciones_internas
    (organization_id, usuario_id, tipo, titulo, mensaje, enlace, entidad_tipo, entidad_id)
  VALUES
    (NEW.organization_id, NEW.responsable_id, 'auditoria_asignacion',
     v_titulo, v_msg, '/auditoria', 'embarque', NEW.embarque_id);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloquear la asignación por un fallo de notificación
  RAISE WARNING 'notificar_asignacion_hallazgo falló: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_asignacion_hallazgo ON public.auditoria_revisiones;
CREATE TRIGGER trg_notificar_asignacion_hallazgo
  AFTER INSERT OR UPDATE OF responsable_id
  ON public.auditoria_revisiones
  FOR EACH ROW EXECUTE FUNCTION public.notificar_asignacion_hallazgo();
