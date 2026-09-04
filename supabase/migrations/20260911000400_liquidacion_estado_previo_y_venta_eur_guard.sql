-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Venta en EUR: guard server-side (YAGNI: hoy no hay ventas en EUR).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._assert_concepto_venta_moneda_soportada()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sólo se valida cuando la moneda entra o cambia, para no bloquear
  -- correcciones/soft-delete de filas legacy.
  IF NEW.moneda = 'EUR'::public.moneda
     AND (TG_OP = 'INSERT' OR OLD.moneda IS DISTINCT FROM NEW.moneda) THEN
    RAISE EXCEPTION 'LC_VENTA_EUR_NO_SOPORTADA: La venta sólo se factura en MXN o USD; captura el concepto en pesos o dólares.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_conceptos_venta_moneda_soportada ON public.conceptos_venta;
CREATE TRIGGER trg_conceptos_venta_moneda_soportada
BEFORE INSERT OR UPDATE OF moneda ON public.conceptos_venta
FOR EACH ROW EXECUTE FUNCTION public._assert_concepto_venta_moneda_soportada();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Estado previo de la comisión al liquidarse (para cancelar sin doble pago).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.comisiones_devengadas
  ADD COLUMN IF NOT EXISTS estado_previo_liquidacion public.estado_comision;

COMMENT ON COLUMN public.comisiones_devengadas.estado_previo_liquidacion IS
  'Estado que tenía la comisión antes de incluirse en una liquidación; se usa para restaurarla si la liquidación se cancela.';

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

CREATE OR REPLACE FUNCTION public.cancelar_liquidacion_comision(p_liquidacion_id uuid, p_motivo text)
RETURNS public.liquidaciones_comision
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.liquidaciones_comision;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(TRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_MOTIVO_REQUERIDO: Captura el motivo de la cancelación.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.liquidaciones_comision
  WHERE id = p_liquidacion_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_NO_EXISTE: La liquidación no existe.';
  END IF;

  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_OTRA_ORG: La liquidación pertenece a otra organización.';
  END IF;

  -- YG-02: rol financiero POR MEMBRESÍA en la org dueña de la liquidación.
  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_row.organization_id) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden cancelar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RETURN v_row;
  END IF;

  IF v_row.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_PAGADA_NO_CANCELABLE: La liquidación ya fue pagada; registra el ajuste en la siguiente liquidación.'
      USING ERRCODE = '42501';
  END IF;

  -- YG-03: cada comisión regresa a su estado previo. El fallback cubre filas
  -- legacy sin `estado_previo_liquidacion` capturado.
  UPDATE public.comisiones_devengadas
     SET estado = COALESCE(
           estado_previo_liquidacion,
           CASE WHEN estado = 'Cancelada' THEN 'Por recuperar'::public.estado_comision
                ELSE 'Devengada'::public.estado_comision END),
         estado_previo_liquidacion = NULL,
         liquidacion_id = NULL,
         updated_at = now()
   WHERE liquidacion_id = p_liquidacion_id
     AND estado IN ('Liquidada', 'Cancelada');

  UPDATE public.liquidaciones_comision
     SET estado = 'Cancelada',
         cancelada_at = now(),
         cancelada_por = v_uid,
         motivo_cancelacion = TRIM(p_motivo),
         updated_at = now()
   WHERE id = p_liquidacion_id
  RETURNING * INTO v_row;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'cancelar_liquidacion_comision', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('motivo', TRIM(p_motivo), 'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en cancelar_liquidacion_comision: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_liquidacion_comision(uuid, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._assert_concepto_venta_moneda_soportada() FROM PUBLIC, anon;
-- Sólo lo invoca el trigger: no requiere EXECUTE para roles de la API.
GRANT EXECUTE ON FUNCTION public._assert_concepto_venta_moneda_soportada() TO service_role;
