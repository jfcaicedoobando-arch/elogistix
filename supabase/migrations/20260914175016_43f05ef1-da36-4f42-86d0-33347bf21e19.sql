-- Lote financiero M1-M5 (v13.823.384) · parte 4/5
CREATE OR REPLACE FUNCTION public.ejecutar_pago_programado(p_factura_id uuid, p_cuenta_bancaria_id uuid, p_fecha date, p_monto numeric, p_metodo_pago text DEFAULT 'Transferencia'::text, p_referencia text DEFAULT ''::text, p_request_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_factura public.proveedor_facturas;
  v_cuenta public.cuentas_bancarias;
  v_saldo_cuenta numeric;
  v_pago public.pagos_proveedor;
  v_mov_id uuid;
  v_resp jsonb;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_cached := public.idempotency_claim(p_request_id, 'ejecutar_pago_programado');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_PAGO_PROGRAMADO_EN_PROCESO: Este pago programado ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN v_cached;
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_MONTO_INVALIDO: El monto del pago no es válido.';
  END IF;

  SELECT * INTO v_factura
    FROM public.proveedor_facturas
    WHERE id = p_factura_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura de proveedor no existe o fue eliminada.';
  END IF;

  v_org := v_factura.organization_id;

  -- Rol EXACTO dentro de la organización de la factura (antes bastaba tener
  -- el rol en CUALQUIER organización).
  IF NOT (
    public.has_role(v_uid, 'super_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
       WHERE om.organization_id = v_org
         AND om.user_id = v_uid
         AND om.role::text = ANY (ARRAY['admin','admin_org','tesorero'])
    )
  ) THEN
    RAISE EXCEPTION 'LC_SOD_VIOLATION: Tu rol no puede ejecutar pagos programados en esta organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_factura.fecha_programada_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PROGRAMACION: la factura no tiene fecha programada de pago; prográmala antes de ejecutarla.'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_fecha IS NULL
     OR (v_factura.fecha_emision IS NOT NULL AND p_fecha < v_factura.fecha_emision)
     OR p_fecha > public.fecha_negocio_mx() THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: la fecha del pago (%) debe estar entre la emisión (%) y hoy (%).',
      p_fecha, v_factura.fecha_emision, public.fecha_negocio_mx() USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_cuenta
    FROM public.cuentas_bancarias
    WHERE id = p_cuenta_bancaria_id AND deleted_at IS NULL
    FOR UPDATE;
  IF v_cuenta.id IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_EXISTE: La cuenta bancaria no existe o fue eliminada.';
  END IF;

  IF v_cuenta.organization_id <> v_org THEN
    RAISE EXCEPTION 'LC_CUENTA_ORG_MISMATCH: La cuenta bancaria pertenece a otra organización.';
  END IF;

  IF v_cuenta.moneda <> v_factura.moneda THEN
    RAISE EXCEPTION 'LC_PAGO_MONEDA_CUENTA_MISMATCH: La moneda de la cuenta (%) no coincide con la de la factura (%).',
      v_cuenta.moneda, v_factura.moneda;
  END IF;

  v_saldo_cuenta := public.saldo_cuenta_bancaria(v_cuenta.id);

  IF p_monto > v_saldo_cuenta + 0.005 THEN
    RAISE EXCEPTION 'LC_CUENTA_SALDO_INSUFICIENTE: El saldo de la cuenta (%) es insuficiente para pagar %.',
      round(v_saldo_cuenta, 2), round(p_monto, 2);
  END IF;

  INSERT INTO public.pagos_proveedor (
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
    metodo_pago, referencia, cuenta_bancaria_id, notas, created_by
  ) VALUES (
    v_org, p_factura_id, p_fecha, p_monto, v_factura.moneda,
    p_metodo_pago, COALESCE(p_referencia, ''), v_cuenta.id,
    'Ejecución de pago programado', v_uid
  )
  RETURNING * INTO v_pago;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, saldo, hash_dedupe, estado_conciliacion,
    pago_proveedor_id, conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_org, v_cuenta.id, p_fecha,
    'Pago programado: ' || COALESCE(v_factura.proveedor_nombre, ''),
    COALESCE(p_referencia, ''),
    p_monto, 0, v_saldo_cuenta - p_monto,
    'pago-programado-' || v_pago.id::text,
    'Conciliado', v_pago.id, v_uid, now(), v_uid
  )
  RETURNING id INTO v_mov_id;

  v_resp := jsonb_build_object(
    'pago_id', v_pago.id,
    'movimiento_id', v_mov_id,
    'saldo_cuenta_restante', v_saldo_cuenta - p_monto
  );

  PERFORM public.idempotency_store(p_request_id, v_resp);

  RETURN v_resp;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_pago_liquidacion(p_liquidacion_id uuid, p_fecha_pago date, p_metodo_pago text, p_referencia text DEFAULT NULL::text, p_notas text DEFAULT NULL::text)
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

  -- YG-02: primero la fila (con candado), después la autorización por org.
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

  -- YG-02: rol financiero POR MEMBRESÍA en la org dueña de la liquidación,
  -- lista exacta {admin, admin_org, super_admin, contador, tesorero}.
  IF NOT public.has_any_role_in_org_exact(v_uid,
       ARRAY['admin','admin_org','super_admin','contador','tesorero']::public.app_role[],
       v_row.organization_id) THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_SIN_ROL: Sólo administración, contabilidad o tesorería pueden pagar liquidaciones.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_CANCELADA: La liquidación está cancelada; genera una nueva.'
      USING ERRCODE = '42501';
  END IF;

  IF v_row.fecha_pago IS NOT NULL OR v_row.estado = 'Pagada' THEN
    -- B-3 · Idempotencia: un reintento con los MISMOS datos (fecha, método y,
    -- cuando se envía, referencia) devuelve la fila ya pagada en lugar de
    -- fallar. No se re-escribe nada ni se duplica la bitácora.
    IF v_row.fecha_pago IS NOT DISTINCT FROM p_fecha_pago
       AND COALESCE(btrim(v_row.metodo_pago), '') = COALESCE(btrim(p_metodo_pago), '')
       AND (p_referencia IS NULL
            OR COALESCE(btrim(v_row.referencia), '') = COALESCE(btrim(p_referencia), '')) THEN
      RETURN v_row;
    END IF;

    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado el %.', v_row.fecha_pago
      USING ERRCODE = '42501';
  END IF;

  IF p_fecha_pago IS NULL OR p_fecha_pago > public.fecha_negocio_mx() THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.liquidaciones_comision
     SET fecha_pago = p_fecha_pago,
         metodo_pago = p_metodo_pago,
         referencia = COALESCE(p_referencia, referencia),
         notas = COALESCE(p_notas, notas),
         estado = 'Pagada',
         updated_at = now()
   WHERE id = p_liquidacion_id
     AND fecha_pago IS NULL
     AND estado = 'Generada'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_LIQUIDACION_YA_PAGADA: Esta liquidación ya tiene un pago registrado.'
      USING ERRCODE = '42501';
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'registrar_pago_liquidacion', 'comisiones',
            v_row.id, 'Liquidación ' || v_row.periodo,
            jsonb_build_object('fecha_pago', p_fecha_pago, 'metodo_pago', p_metodo_pago,
                               'total_mxn', v_row.total_mxn));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_liquidacion: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_row;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_liquidacion(uuid, date, text, text, text) TO authenticated, service_role;

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

  -- M4 (v13.823.384): se revierten SÓLO las porciones recuperadas por ESTA
  -- liquidación. No se borran: quedan marcadas, así el rastro de auditoría se
  -- conserva y la deuda pendiente vuelve a su monto anterior por sí sola.
  UPDATE public.comisiones_recuperaciones
     SET revertida_at = now(),
         revertida_por = v_uid
   WHERE liquidacion_id = p_liquidacion_id
     AND revertida_at IS NULL;

  -- YG-03: cada comisión regresa a su estado previo. El fallback cubre filas
  -- legacy sin `estado_previo_liquidacion` capturado. Las comisiones con
  -- recuperación PARCIAL nunca se ligaron a la liquidación, así que siguen
  -- "Por recuperar" sin tocarse.
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
-- H6: reafirmación de privilegios canónicos de la RPC reemitida por M3.
-- Mismos roles que antes de reemitirse (sólo `authenticated`): no se expande acceso.
REVOKE ALL ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ejecutar_pago_programado(uuid, uuid, date, numeric, text, text, uuid) TO authenticated;
