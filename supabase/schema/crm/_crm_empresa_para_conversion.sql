-- Identidad explícita compartida por las conversiones. No infiere por nombre.
-- Orden de locks compatible con crm_empresa_pasar_a_prospecto: empresa -> lead -> oportunidad.
CREATE OR REPLACE FUNCTION public._crm_empresa_para_conversion(p_org uuid, p_lead uuid, p_oportunidad uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ids uuid[]; v_actuales uuid[]; v_emp public.crm_empresas%ROWTYPE;
BEGIN
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_ids FROM (
    SELECT e.id FROM public.crm_empresas e WHERE e.lead_origen_id = p_lead
    UNION
    SELECT oe.empresa_id FROM public.crm_oportunidad_empresa oe
      WHERE oe.oportunidad_id = p_oportunidad
  ) targets;
  IF coalesce(cardinality(v_ids), 0) = 0 THEN RETURN NULL; END IF;
  IF cardinality(v_ids) <> 1 THEN
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE' USING ERRCODE = '23514';
  END IF;
  -- No filtrar deleted_at antes de esperar: se valida la fila vigente tras el lock.
  SELECT * INTO v_emp FROM public.crm_empresas WHERE id = v_ids[1] FOR UPDATE;
  IF NOT FOUND OR v_emp.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CRM_EMPRESA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;
  IF v_emp.organization_id IS DISTINCT FROM p_org OR EXISTS (
    SELECT 1 FROM public.crm_oportunidad_empresa oe
      WHERE oe.oportunidad_id = p_oportunidad AND oe.organization_id IS DISTINCT FROM p_org
  ) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA' USING ERRCODE = '42501';
  END IF;
  SELECT array_agg(DISTINCT id ORDER BY id) INTO v_actuales FROM (
    SELECT e.id FROM public.crm_empresas e WHERE e.lead_origen_id = p_lead
    UNION
    SELECT oe.empresa_id FROM public.crm_oportunidad_empresa oe
      WHERE oe.oportunidad_id = p_oportunidad
  ) targets;
  IF v_actuales IS DISTINCT FROM v_ids THEN
    RAISE EXCEPTION 'LC_CONVERSION_INCONSISTENTE' USING ERRCODE = '23514';
  END IF;
  RETURN v_emp.id;
END $$;
REVOKE ALL ON FUNCTION public._crm_empresa_para_conversion(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crm_empresa_para_conversion(uuid,uuid,uuid) TO service_role;

