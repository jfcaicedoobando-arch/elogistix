-- Espejo canónico de public.generar_liquidacion_comision
-- Fuente vigente (mayor timestamp): 20260828000200_rev2_espejo_comisiones_nc_y_periodo.sql
-- Vigilado por `bun run audit:replay-mirror` y `audit:schema-functions`.

CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(p_vendedora_id uuid, p_periodo text, p_organization_id uuid, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
  v_cached jsonb;
BEGIN
  IF NOT has_any_role_efectivo(auth.uid(),
        ARRAY['admin','admin_org','contador','tesorero']::app_role[]) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  v_cached := public.idempotency_claim(p_request_id, 'generar_liquidacion_comision');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_LIQUIDACION_EN_PROCESO: Esta liquidación ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN (v_cached->>'liquidacion_id')::uuid;
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM public.comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  INSERT INTO public.liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE public.comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('liquidacion_id', v_liq_id, 'total_mxn', v_total));

  RETURN v_liq_id;
END;
$function$;
