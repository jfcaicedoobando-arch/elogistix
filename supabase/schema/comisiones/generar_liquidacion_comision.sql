-- Espejo canónico de public.generar_liquidacion_comision
-- Fuente vigente (mayor timestamp): 20260911000400_liquidacion_estado_previo_y_venta_eur_guard.sql
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
  v_disponible numeric(14,2);
  v_aplicado numeric(14,2) := 0;
  v_rec record;
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

  -- Auditoría 2026-08-28 · Hallazgo 1: las comisiones "Por recuperar" (ya
  -- pagadas y cuyo respaldo se canceló/acreditó después) quedaban huérfanas.
  -- Se descuentan de esta liquidación, de la más antigua a la más reciente y
  -- sólo hasta donde alcance el devengo del periodo; el remanente sigue
  -- pendiente para la siguiente liquidación.
  v_disponible := v_total;
  FOR v_rec IN
    SELECT id, comision_mxn
      FROM public.comisiones_devengadas
     WHERE organization_id = v_org
       AND vendedora_id = p_vendedora_id
       AND estado = 'Por recuperar'
     ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_disponible <= 0;
    CONTINUE WHEN v_rec.comision_mxn > v_disponible;
    v_disponible := v_disponible - v_rec.comision_mxn;
    v_aplicado := v_aplicado + v_rec.comision_mxn;
  END LOOP;

  INSERT INTO public.liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, ROUND(v_total - v_aplicado, 2), auth.uid())
  RETURNING id INTO v_liq_id;

  -- YG-03: se conserva el estado previo para poder restaurarlo si la
  -- liquidación se cancela (una comisión "Por recuperar" no debe volver a
  -- "Devengada", porque se pagaría dos veces).
  UPDATE public.comisiones_devengadas
     SET estado = 'Liquidada',
         estado_previo_liquidacion = 'Devengada',
         liquidacion_id = v_liq_id,
         updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM') = p_periodo;

  IF v_aplicado > 0 THEN
    v_disponible := v_total;
    FOR v_rec IN
      SELECT id, comision_mxn
        FROM public.comisiones_devengadas
       WHERE organization_id = v_org
         AND vendedora_id = p_vendedora_id
         AND estado = 'Por recuperar'
       ORDER BY created_at ASC
    LOOP
      EXIT WHEN v_disponible <= 0;
      CONTINUE WHEN v_rec.comision_mxn > v_disponible;
      v_disponible := v_disponible - v_rec.comision_mxn;
      UPDATE public.comisiones_devengadas
         SET estado = 'Cancelada',
             estado_previo_liquidacion = 'Por recuperar',
             liquidacion_id = v_liq_id,
             nota = COALESCE(nota || ' · ', '')
                    || 'Recuperada al descontarse de la liquidación del periodo ' || p_periodo,
             updated_at = now()
       WHERE id = v_rec.id;
    END LOOP;
  END IF;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('liquidacion_id', v_liq_id,
                       'total_mxn', ROUND(v_total - v_aplicado, 2),
                       'recuperado_mxn', v_aplicado));

  RETURN v_liq_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) TO authenticated, service_role;
