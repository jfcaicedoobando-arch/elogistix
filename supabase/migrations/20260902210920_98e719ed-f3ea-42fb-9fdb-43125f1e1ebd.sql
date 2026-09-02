-- v13.823.56 · Integridad tenant polimórfica de crm_actividades, reloj de
-- movimiento correcto y numerador de "seguimiento oportuno".
-- Forward-only. No modifica datos existentes.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Guard único de integridad tenant para el vínculo polimórfico.
--    Cubre los cuatro valores reales del enum crm_entidad_tipo.
--    Mensaje único (LC_CRM_ACTIVIDAD_ENTIDAD_AJENA) para no filtrar si el UUID
--    existe en otra organización. Aplica también a service_role.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._crm_actividad_entidad_misma_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ok boolean := false;
BEGIN
  IF NEW.entidad_id IS NULL THEN
    RAISE EXCEPTION 'LC_CRM_ACTIVIDAD_ENTIDAD_AJENA: la entidad ligada no existe, está eliminada o pertenece a otra organización';
  END IF;

  CASE NEW.entidad_tipo
    WHEN 'lead'::public.crm_entidad_tipo THEN
      SELECT EXISTS (
        SELECT 1 FROM public.crm_leads l
         WHERE l.id = NEW.entidad_id
           AND l.organization_id = NEW.organization_id
           AND l.deleted_at IS NULL
      ) INTO v_ok;
    WHEN 'oportunidad'::public.crm_entidad_tipo THEN
      SELECT EXISTS (
        SELECT 1 FROM public.crm_oportunidades o
         WHERE o.id = NEW.entidad_id
           AND o.organization_id = NEW.organization_id
           AND o.deleted_at IS NULL
      ) INTO v_ok;
    WHEN 'cliente'::public.crm_entidad_tipo THEN
      SELECT EXISTS (
        SELECT 1 FROM public.clientes c
         WHERE c.id = NEW.entidad_id
           AND c.organization_id = NEW.organization_id
           AND c.deleted_at IS NULL
      ) INTO v_ok;
    WHEN 'contacto'::public.crm_entidad_tipo THEN
      SELECT EXISTS (
        SELECT 1 FROM public.contactos_cliente ct
         WHERE ct.id = NEW.entidad_id
           AND ct.organization_id = NEW.organization_id
           AND ct.deleted_at IS NULL
      ) INTO v_ok;
    ELSE
      v_ok := false;  -- Enum ampliado sin actualizar el guard: falla cerrado.
  END CASE;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'LC_CRM_ACTIVIDAD_ENTIDAD_AJENA: la entidad ligada no existe, está eliminada o pertenece a otra organización';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_crm_actividad_entidad_misma_org ON public.crm_actividades;
CREATE TRIGGER trg_crm_actividad_entidad_misma_org
BEFORE INSERT OR UPDATE OF organization_id, entidad_tipo, entidad_id
ON public.crm_actividades
FOR EACH ROW EXECUTE FUNCTION public._crm_actividad_entidad_misma_org();

REVOKE ALL ON FUNCTION public._crm_actividad_entidad_misma_org() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crm_actividad_entidad_misma_org() FROM anon;
REVOKE ALL ON FUNCTION public._crm_actividad_entidad_misma_org() FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Reloj de movimiento: sólo alta de actividad de oportunidad y transición
--    NULL → valor de fecha_completada refrescan ultimo_movimiento_at.
--    Sin EXCEPTION WHEN OTHERS: cualquier error debe propagarse.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._crm_actividad_toca_oportunidad()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.entidad_tipo <> 'oportunidad'::public.crm_entidad_tipo
     OR NEW.entidad_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NOT (OLD.fecha_completada IS NULL AND NEW.fecha_completada IS NOT NULL) THEN
    -- Reprogramar, editar notas o resultado no rejuvenece el SLA.
    RETURN NEW;
  END IF;

  UPDATE public.crm_oportunidades
     SET ultimo_movimiento_at = now()
   WHERE id = NEW.entidad_id
     AND organization_id = NEW.organization_id
     AND deleted_at IS NULL;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_crm_actividad_toca_oportunidad ON public.crm_actividades;
CREATE TRIGGER trg_crm_actividad_toca_oportunidad
AFTER INSERT OR UPDATE OF fecha_completada
ON public.crm_actividades
FOR EACH ROW EXECUTE FUNCTION public._crm_actividad_toca_oportunidad();

REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM anon;
REVOKE ALL ON FUNCTION public._crm_actividad_toca_oportunidad() FROM authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) "Seguimiento oportuno": numerador = abiertas CON próxima actividad
--    agendada y no vencida. Antes, las oportunidades sin ninguna actividad
--    agendada se contaban como al día (NOT actividad_vencida = true).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_higiene_pipeline()
RETURNS TABLE(abiertas integer, registros_completos integer, higiene_pct numeric, seguimiento_oportuno_pct numeric, vencidas integer, sin_actividad_programada integer, pipeline_bruto numeric, pipeline_ponderado numeric, tc_fecha date, tc_estimado boolean)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  WITH h AS (SELECT * FROM public.crm_higiene_oportunidades()),
  tc AS (SELECT * FROM public.tc_dof_vigente(CURRENT_DATE)),
  m AS (
    SELECT
      h.*,
      CASE upper(COALESCE(h.moneda, 'MXN'))
        WHEN 'MXN' THEN COALESCE(h.monto_estimado, 0)
        WHEN 'USD' THEN COALESCE(h.monto_estimado, 0) * (SELECT usd_mxn FROM tc)
        WHEN 'EUR' THEN COALESCE(h.monto_estimado, 0) * (SELECT eur_mxn FROM tc)
        ELSE NULL
      END AS monto_mxn
    FROM h
  )
  SELECT COUNT(*)::int,
         COUNT(*) FILTER (WHERE registro_completo)::int,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(COUNT(*) FILTER (WHERE registro_completo)::numeric / COUNT(*), 4) END,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(
                COUNT(*) FILTER (
                  WHERE proxima_actividad_at IS NOT NULL AND NOT actividad_vencida
                )::numeric / COUNT(*), 4) END,
         COUNT(*) FILTER (WHERE estado_higiene = 'vencida')::int,
         COUNT(*) FILTER (WHERE proxima_actividad_at IS NULL)::int,
         ROUND(COALESCE(SUM(monto_mxn), 0), 2),
         ROUND(COALESCE(SUM(monto_mxn * COALESCE(probabilidad, 0) / 100.0), 0), 2),
         (SELECT fecha FROM tc),
         -- Estimado cuando hay montos en moneda extranjera que no se pudieron
         -- convertir (sin TC DOF publicado o moneda no soportada).
         EXISTS (
           SELECT 1 FROM m
           WHERE m.monto_mxn IS NULL
             AND COALESCE(m.monto_estimado, 0) <> 0
         )
    FROM m;
$function$;