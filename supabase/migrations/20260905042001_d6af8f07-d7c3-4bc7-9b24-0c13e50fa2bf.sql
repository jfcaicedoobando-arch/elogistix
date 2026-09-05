CREATE OR REPLACE FUNCTION public.crm_intercambiar_orden_etapas(p_etapa_a uuid, p_etapa_b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_a_org uuid;
  v_b_org uuid;
  v_a_orden integer;
  v_b_orden integer;
BEGIN
  IF p_etapa_a IS NULL OR p_etapa_b IS NULL OR p_etapa_a = p_etapa_b THEN
    RAISE EXCEPTION 'LC_ETAPA_INTERCAMBIO_INVALIDO: se requieren dos etapas distintas';
  END IF;

  -- Bloqueo determinista por id para evitar deadlocks y órdenes duplicados
  -- cuando se pulsa subir/bajar varias veces en paralelo.
  PERFORM 1
  FROM public.crm_etapas_pipeline
  WHERE id IN (p_etapa_a, p_etapa_b) AND deleted_at IS NULL
  ORDER BY id
  FOR UPDATE;

  SELECT organization_id, orden INTO v_a_org, v_a_orden
  FROM public.crm_etapas_pipeline WHERE id = p_etapa_a AND deleted_at IS NULL;

  SELECT organization_id, orden INTO v_b_org, v_b_orden
  FROM public.crm_etapas_pipeline WHERE id = p_etapa_b AND deleted_at IS NULL;

  IF v_a_org IS NULL OR v_b_org IS NULL THEN
    RAISE EXCEPTION 'LC_ETAPA_NO_ENCONTRADA: etapa inexistente o eliminada';
  END IF;

  IF v_a_org <> v_b_org THEN
    RAISE EXCEPTION 'LC_ETAPA_ORG_DISTINTA: las etapas no pertenecen a la misma organización';
  END IF;

  IF v_a_orden = v_b_orden THEN
    RETURN;
  END IF;

  UPDATE public.crm_etapas_pipeline SET orden = v_b_orden, updated_at = now() WHERE id = p_etapa_a;
  UPDATE public.crm_etapas_pipeline SET orden = v_a_orden, updated_at = now() WHERE id = p_etapa_b;
END;
$$;

REVOKE ALL ON FUNCTION public.crm_intercambiar_orden_etapas(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_intercambiar_orden_etapas(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_intercambiar_orden_etapas(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_intercambiar_orden_etapas(uuid, uuid) TO service_role;