-- Espejo de replay (informe 2026-08-22 · Entrega 4): re-emite M-1/M-2 con
-- timestamp posterior a los espejos 20260826*/20260827*.
-- ============================================================
-- Ola de remediación (informe 2026-08-22) · Entrega 4 (M-1 / M-2)
-- M-1 · crm_propagar_conversion_cliente: cualquier vendedor de la org podía
--       propagar la conversión de una oportunidad ajena y pisar el vínculo.
-- M-2 · El rol se valida ANTES de la existencia/tenencia (sin oráculo).
-- ============================================================

CREATE OR REPLACE FUNCTION public.crm_propagar_conversion_cliente(p_oportunidad_id uuid, p_cliente_id uuid, p_cliente_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_op public.crm_oportunidades;
  v_lead_id uuid;
  v_cliente_org uuid;
  v_uid uuid := auth.uid();
  v_gerencial boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_NO_AUTENTICADO';
  END IF;

  IF p_oportunidad_id IS NULL OR p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'LC_PARAMETROS_INVALIDOS';
  END IF;

  -- M-2: el permiso primero; así un usuario sin rol no distingue entre
  -- "no existe" y "no es tuya".
  v_gerencial := public.has_any_role_efectivo(v_uid,
    ARRAY['admin','admin_org','super_admin','gerente_comercial','gerente_operaciones']::app_role[]);

  IF NOT v_gerencial
     AND NOT public.has_role(v_uid, 'vendedor'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SIN_PERMISO';
  END IF;

  SELECT * INTO v_op
  FROM public.crm_oportunidades
  WHERE id = p_oportunidad_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_op.id IS NULL THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_NO_ENCONTRADA';
  END IF;

  IF public.is_org_member(v_op.organization_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'LC_ORG_AJENA';
  END IF;

  -- M-1: sólo el vendedor dueño (o un rol gerencial) propaga la conversión.
  IF NOT v_gerencial AND COALESCE(v_op.vendedor_id, v_op.created_by) IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_AJENA: la oportunidad está asignada a otra persona';
  END IF;

  -- M-1: no pisar una conversión previa hacia otro cliente.
  IF v_op.cliente_id IS NOT NULL AND v_op.cliente_id <> p_cliente_id THEN
    RAISE EXCEPTION 'LC_OPORTUNIDAD_YA_CONVERTIDA: la oportunidad ya está ligada a otro cliente';
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

REVOKE ALL ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_propagar_conversion_cliente(uuid, uuid, text) TO authenticated, service_role;