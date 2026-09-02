-- ============================================================================
-- v13.823.52 — Microcorrección sobre v13.823.51.
-- 1) ACL real service_role-only: PostgreSQL concede EXECUTE a PUBLIC por
--    defecto, así que revocar sólo anon/authenticated no cerraba nada.
-- 2) Invariantes multiempresa restantes: etapa_id y motivo_perdida_id deben
--    apuntar a filas vivas/activas de la MISMA organización.
-- Forward-only e idempotente. NO corrige datos (preflight: 0 referencias
-- cross-org/inexistentes).
-- ============================================================================

-- 1) ACL: cerrar PUBLIC además de anon/authenticated.
REVOKE ALL ON FUNCTION public._cotizacion_oportunidad_misma_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_actividad_entidad_misma_org() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._crm_probabilidad_terminal() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._cotizacion_oportunidad_misma_org() TO service_role;
GRANT EXECUTE ON FUNCTION public._crm_actividad_entidad_misma_org() TO service_role;
GRANT EXECUTE ON FUNCTION public._crm_probabilidad_terminal() TO service_role;

-- 2) Etapa y motivo de pérdida: misma organización, vivos y activos.
CREATE OR REPLACE FUNCTION public._crm_oportunidad_etapa_motivo_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.crm_etapas_pipeline e
     WHERE e.id = NEW.etapa_id
       AND e.organization_id = NEW.organization_id
       AND e.deleted_at IS NULL
       AND e.activa
  ) THEN
    RAISE EXCEPTION 'LC_ETAPA_AJENA: la etapa no existe, está inactiva o pertenece a otra organización';
  END IF;

  IF NEW.motivo_perdida_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_motivos_perdida m
     WHERE m.id = NEW.motivo_perdida_id
       AND m.organization_id = NEW.organization_id
       AND m.deleted_at IS NULL
       AND m.activa
  ) THEN
    RAISE EXCEPTION 'LC_MOTIVO_PERDIDA_AJENO: el motivo de pérdida no existe, está inactivo o pertenece a otra organización';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_oportunidad_etapa_motivo_misma_org() TO service_role;

DROP TRIGGER IF EXISTS trg_crm_etapa_motivo_misma_org ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_etapa_motivo_misma_org
BEFORE INSERT OR UPDATE OF etapa_id, motivo_perdida_id, organization_id ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public._crm_oportunidad_etapa_motivo_misma_org();

-- 3) Segunda barrera: los lectores de etapa filtran por organización.
CREATE OR REPLACE FUNCTION public._crm_probabilidad_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tipo INTO v_tipo
    FROM public.crm_etapas_pipeline
   WHERE id = NEW.etapa_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;
  IF v_tipo = 'ganada'::crm_etapa_tipo THEN
    NEW.probabilidad := 100;
  ELSIF v_tipo = 'perdida'::crm_etapa_tipo THEN
    NEW.probabilidad := 0;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._crm_validar_motivo_perdida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo public.crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT tipo INTO v_tipo
    FROM public.crm_etapas_pipeline
   WHERE id = NEW.etapa_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;
  IF v_tipo = 'perdida' AND NEW.motivo_perdida_id IS NULL THEN
    RAISE EXCEPTION
      'LC_MOTIVO_PERDIDA_REQUERIDO: indica el motivo de pérdida para cerrar la oportunidad'
      USING ERRCODE = '22023';
  END IF;
  IF v_tipo IS DISTINCT FROM 'perdida' AND NEW.motivo_perdida_id IS NOT NULL THEN
    NEW.motivo_perdida_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;
