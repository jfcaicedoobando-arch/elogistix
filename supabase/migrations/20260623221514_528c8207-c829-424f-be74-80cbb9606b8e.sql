
-- Defensa en profundidad para tarifas subidas por el agente_carga desde el portal:
-- 1) En INSERT: si el caller tiene rol agente_carga, forzar estado_aprobacion='borrador'.
-- 2) En UPDATE: si el caller tiene rol agente_carga, prohibir tocar filas vigente/reemplazada
--    y forzar el estado a 'borrador' tras cualquier edición (re-aprobación).
-- La RLS ya bloquea WITH CHECK fuera de borrador/rechazada, pero esto evita que el agente
-- intente colarse poniendo manualmente 'vigente' en el payload.

CREATE OR REPLACE FUNCTION public.costeo_tarifas_agente_force_borrador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sólo aplica a usuarios con rol agente_carga (operaciones/admins pueden setear lo que quieran).
  IF NOT public.has_role(auth.uid(), 'agente_carga') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.estado_aprobacion := 'borrador';
    NEW.estado := COALESCE(NEW.estado, 'vigente');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Bloquear edición de tarifas ya aprobadas o reemplazadas: el agente debe duplicar.
    IF OLD.estado_aprobacion = 'vigente' OR OLD.estado = 'reemplazada' THEN
      RAISE EXCEPTION 'No puedes editar una tarifa vigente o reemplazada. Duplícala para crear una nueva versión.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Cualquier edición desde el portal regresa la tarifa a borrador.
    NEW.estado_aprobacion := 'borrador';
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_costeo_tarifas_agente_force_borrador ON public.costeo_tarifas;
CREATE TRIGGER trg_costeo_tarifas_agente_force_borrador
BEFORE INSERT OR UPDATE ON public.costeo_tarifas
FOR EACH ROW
EXECUTE FUNCTION public.costeo_tarifas_agente_force_borrador();
