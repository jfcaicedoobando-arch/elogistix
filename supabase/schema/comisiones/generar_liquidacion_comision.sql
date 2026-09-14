-- Espejo canónico de public.generar_liquidacion_comision
-- M4/M5 (v13.823.384):
--   · M4 — RECUPERACIÓN PARCIAL. Antes se hacía `CONTINUE` cuando una deuda
--     individual excedía el devengo del periodo, así que una deuda de 150 con
--     devengo de 100 pagaba los 100 completos y dejaba la deuda intacta. Ahora
--     se descuenta la PORCIÓN que alcance y cada porción se registra en
--     `public.comisiones_recuperaciones` (rastro auditable, monto original
--     intacto, sin doble recuperación).
--   · M5 — SERIALIZACIÓN. `pg_advisory_xact_lock` por (organización, vendedora)
--     antes de leer devengadas y deudas: dos liquidaciones simultáneas de
--     periodos distintos ya no pueden descontar la misma deuda.
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
  v_pendiente numeric(14,2);
  v_porcion numeric(14,2);
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

  -- M5: candado transaccional único por (org, vendedora). Es un solo lock por
  -- transacción y siempre sobre la misma llave, así que no hay ciclos de espera
  -- (imposible el deadlock entre dos liquidaciones de la misma vendedora).
  PERFORM pg_advisory_xact_lock(
    hashtextextended('comisiones:' || v_org::text || ':' || COALESCE(p_vendedora_id::text, '-'), 0));

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

  -- Auditoría 2026-08-28 · Hallazgo 1 + M4: las comisiones "Por recuperar" (ya
  -- pagadas y cuyo respaldo se canceló/acreditó después) se descuentan de esta
  -- liquidación, de la más antigua a la más reciente y hasta donde alcance el
  -- devengo del periodo. Lo que no alcance sigue pendiente para la siguiente.
  v_disponible := v_total;
  FOR v_rec IN
    SELECT id, comision_mxn
      FROM public.comisiones_devengadas
     WHERE organization_id = v_org
       AND vendedora_id = p_vendedora_id
       AND estado = 'Por recuperar'
     ORDER BY created_at ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_disponible <= 0;

    -- Lo YA recuperado (porciones vivas) nunca se vuelve a descontar: es el
    -- candado contra la doble recuperación. El monto original no se toca.
    SELECT ROUND(v_rec.comision_mxn
                 - COALESCE(SUM(r.monto_mxn), 0), 2)
      INTO v_pendiente
      FROM public.comisiones_recuperaciones r
     WHERE r.comision_id = v_rec.id
       AND r.revertida_at IS NULL;

    CONTINUE WHEN v_pendiente IS NULL OR v_pendiente <= 0;

    v_porcion := LEAST(v_pendiente, v_disponible);

    INSERT INTO public.comisiones_recuperaciones
      (organization_id, liquidacion_id, comision_id, monto_mxn, created_by)
    VALUES (v_org, v_liq_id, v_rec.id, v_porcion, auth.uid());

    v_disponible := ROUND(v_disponible - v_porcion, 2);
    v_aplicado := ROUND(v_aplicado + v_porcion, 2);

    IF v_pendiente - v_porcion <= 0 THEN
      -- Deuda liquidada por completo: la comisión se cierra ligada a ESTA
      -- liquidación (su estado previo permite restaurarla si se cancela).
      UPDATE public.comisiones_devengadas
         SET estado = 'Cancelada',
             estado_previo_liquidacion = 'Por recuperar',
             liquidacion_id = v_liq_id,
             nota = COALESCE(nota || ' · ', '')
                    || 'Recuperada al descontarse de la liquidación del periodo ' || p_periodo,
             updated_at = now()
       WHERE id = v_rec.id;
    ELSE
      -- Recuperación PARCIAL: la comisión sigue "Por recuperar" con el resto.
      UPDATE public.comisiones_devengadas
         SET nota = COALESCE(nota || ' · ', '')
                    || 'Recuperación parcial de ' || v_porcion::text
                    || ' en la liquidación del periodo ' || p_periodo,
             updated_at = now()
       WHERE id = v_rec.id;
    END IF;
  END LOOP;

  IF v_aplicado > 0 THEN
    UPDATE public.liquidaciones_comision
       SET total_mxn = ROUND(v_total - v_aplicado, 2),
           updated_at = now()
     WHERE id = v_liq_id;
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
