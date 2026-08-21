-- ============================================================================
-- Ola 7 · O7.7 — Propagación transaccional de la conversión prospecto → cliente
--
-- Antes: el frontend hacía 3 escrituras best-effort (update oportunidad,
-- update lead, bitácora). Si fallaba la segunda quedaba el cliente creado con
-- el lead sin convertir (estado inconsistente que se corregía a mano).
--
-- Ahora: una sola RPC SECURITY DEFINER, atómica, con validación de org/rol.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.crm_propagar_conversion_cliente(
  p_oportunidad_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_op public.crm_oportunidades;
  v_lead_id uuid;
  v_cliente_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO';
  END IF;

  IF p_oportunidad_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_PARAMETROS_INVALIDOS';
  END IF;

  SELECT * INTO v_op
  FROM public.crm_oportunidades
  WHERE id = p_oportunidad_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_op.id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_NO_ENCONTRADA';
  END IF;

  IF NOT public.is_org_member(v_op.organization_id) THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  IF NOT public.has_role(auth.uid(), 'vendedor'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO';
  END IF;

  SELECT organization_id INTO v_cliente_org
  FROM public.clientes
  WHERE id = p_cliente_id AND deleted_at IS NULL;

  IF v_cliente_org IS NULL THEN
    RAISE EXCEPTION 'LC_CLIENTE_NO_ENCONTRADO';
  END IF;
  IF v_cliente_org <> v_op.organization_id THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  UPDATE public.crm_oportunidades
     SET cliente_id = p_cliente_id,
         cliente_nombre = COALESCE(NULLIF(p_cliente_nombre, ''), cliente_nombre),
         updated_at = now()
   WHERE id = p_oportunidad_id;

  v_lead_id := v_op.lead_id;

  IF v_lead_id IS NOT NULL THEN
    UPDATE public.crm_leads
       SET estado = 'Convertido'::public.crm_lead_estado,
           cliente_convertido_id = p_cliente_id,
           oportunidad_convertida_id = p_oportunidad_id,
           updated_at = now()
     WHERE id = v_lead_id
       AND organization_id = v_op.organization_id
       AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'oportunidad_id', p_oportunidad_id,
    'cliente_id', p_cliente_id,
    'lead_id', v_lead_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) TO service_role;