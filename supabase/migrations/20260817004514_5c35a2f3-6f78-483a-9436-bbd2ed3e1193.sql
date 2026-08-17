-- Ola A CRM: motivo de pérdida obligatorio + detección de leads duplicados.

-- 1) Trigger: etapa de tipo 'perdida' exige motivo_perdida_id.
CREATE OR REPLACE FUNCTION public._crm_validar_motivo_perdida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo public.crm_etapa_tipo;
BEGIN
  IF NEW.etapa_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT tipo INTO v_tipo
    FROM public.crm_etapas_pipeline
   WHERE id = NEW.etapa_id;

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
$$;

REVOKE ALL ON FUNCTION public._crm_validar_motivo_perdida() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crm_validar_motivo_perdida() FROM anon;
GRANT EXECUTE ON FUNCTION public._crm_validar_motivo_perdida() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_crm_validar_motivo_perdida ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_validar_motivo_perdida
BEFORE INSERT OR UPDATE OF etapa_id, motivo_perdida_id ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public._crm_validar_motivo_perdida();

-- 2) RPC: detección de leads duplicados por lote (empresa/email/teléfono).
CREATE OR REPLACE FUNCTION public.crm_leads_buscar_duplicados(p_claves jsonb)
RETURNS TABLE (
  id uuid,
  empresa text,
  contacto text,
  email text,
  telefono text,
  estado public.crm_lead_estado,
  empresa_norm text,
  email_norm text,
  telefono_norm text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claves AS (
    SELECT
      NULLIF(lower(regexp_replace(coalesce(c->>'empresa', ''), '[^a-z0-9]', '', 'gi')), '') AS empresa_norm,
      NULLIF(lower(trim(coalesce(c->>'email', ''))), '')                                   AS email_norm,
      NULLIF(regexp_replace(coalesce(c->>'telefono', ''), '\D', '', 'g'), '')               AS telefono_norm
    FROM jsonb_array_elements(coalesce(p_claves, '[]'::jsonb)) AS c
  )
  SELECT DISTINCT
    l.id, l.empresa, l.contacto, l.email, l.telefono, l.estado,
    lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) AS empresa_norm,
    lower(trim(coalesce(l.email, '')))                                   AS email_norm,
    regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g')              AS telefono_norm
  FROM public.crm_leads l
  JOIN claves k ON (
       (k.email_norm    IS NOT NULL AND lower(trim(coalesce(l.email, ''))) = k.email_norm)
    OR (k.telefono_norm IS NOT NULL AND length(k.telefono_norm) >= 8
        AND right(regexp_replace(coalesce(l.telefono, ''), '\D', '', 'g'), 10) = right(k.telefono_norm, 10))
    OR (k.empresa_norm  IS NOT NULL AND length(k.empresa_norm) >= 4
        AND lower(regexp_replace(coalesce(l.empresa, ''), '[^a-z0-9]', '', 'gi')) = k.empresa_norm)
  )
  WHERE l.deleted_at IS NULL
    AND public.rls_tenant_scope_ok(l.organization_id);
$$;

REVOKE ALL ON FUNCTION public.crm_leads_buscar_duplicados(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_leads_buscar_duplicados(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_leads_buscar_duplicados(jsonb) TO authenticated, service_role;