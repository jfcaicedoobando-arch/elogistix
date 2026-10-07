-- Reconstruction from verified audit135 report. No historical dates are rewritten.
CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(p_anticipo_id uuid, p_factura_id uuid, p_monto numeric, p_fecha_aplicacion date DEFAULT CURRENT_DATE, p_request_id uuid DEFAULT NULL::uuid)
RETURNS public.anticipos_aplicaciones
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
  v_monto_historico numeric(18,4);
  v_tc_aplicacion numeric;
  v_autorizado boolean;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  v_cached := public.idempotency_claim(p_request_id, 'aplicar_anticipo_a_factura');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Esta aplicación de anticipo ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_ap FROM public.anticipos_aplicaciones
     WHERE id = (v_cached->>'aplicacion_id')::uuid;
    IF v_ap.id IS NOT NULL THEN
      RETURN v_ap;
    END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden aplicar anticipos.'
      USING ERRCODE = '42501';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto a aplicar debe ser mayor a cero.';
  END IF;
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id FOR UPDATE;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;
  IF v_ant.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  IF v_ant.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado.';
  END IF;
  IF v_ant.saldo_disponible + 0.01 < p_monto THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_SALDO: Saldo disponible (%.4f) insuficiente para aplicar %.4f.',
      v_ant.saldo_disponible, p_monto;
  END IF;
  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura no existe.';
  END IF;
  IF v_fact.estado_aprobacion <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura debe estar aprobada antes de aplicar un anticipo.';
  END IF;
  IF v_fact.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_NO_VIVA: La factura está Cancelada y no admite anticipos.'
      USING ERRCODE = '23514';
  END IF;
  IF v_fact.organization_id <> v_ant.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_ORG_MISMATCH: Anticipo y factura pertenecen a organizaciones distintas.';
  END IF;
  IF v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_MISMATCH: Anticipo y factura pertenecen a proveedores distintos.';
  END IF;
  -- Audit135: civil dates must be chronological; downstream payment guards
  -- continue to enforce business date and closed accounting periods.
  IF p_fecha_aplicacion IS NULL
     OR p_fecha_aplicacion < v_ant.fecha_anticipo
     OR p_fecha_aplicacion < v_fact.fecha_emision THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_FECHA: La aplicación no puede preceder a la entrega del anticipo ni a la emisión de la factura.'
      USING ERRCODE = '22023';
  END IF;
  IF v_ant.moneda = v_fact.moneda THEN
    v_monto_convertido := p_monto;
    v_monto_historico := p_monto;
  ELSE
    v_monto_convertido := public.convertir_monto_dof(
      p_monto, v_ant.moneda::text, v_fact.moneda::text, p_fecha_aplicacion);
    BEGIN
      v_monto_historico := public.convertir_monto_pago_a_factura(
        p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);
    EXCEPTION WHEN OTHERS THEN
      v_monto_historico := NULL;
    END;
  END IF;
  v_tc_aplicacion := CASE
    WHEN v_ant.moneda = v_fact.moneda THEN v_ant.tipo_cambio_usd
    WHEN v_ant.moneda = 'MXN'::public.moneda THEN
      COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_fact.moneda::text), v_ant.tipo_cambio_usd)
    ELSE COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_ant.moneda::text), v_ant.tipo_cambio_usd)
  END;
  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_tc_aplicacion,
     COALESCE(NULLIF(TRIM(v_ant.metodo_pago), ''), 'Transferencia'),
     COALESCE(v_ant.referencia,'') || ' (anticipo ' || v_ant.id::text || ')',
     v_ant.cuenta_bancaria_id, 'Aplicación de anticipo ' || v_ant.id::text,
     v_uid, true)
  RETURNING * INTO v_pago;
  -- MNY-P2.4: se relee el pago para tomar el valor que dejaron los triggers.
  SELECT * INTO v_pago FROM public.pagos_proveedor WHERE id = v_pago.id;
  INSERT INTO public.anticipos_aplicaciones
    (organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
     monto_aplicado, moneda_aplicada, fecha_aplicacion, created_by)
  VALUES
    (v_ant.organization_id, p_anticipo_id, p_factura_id, v_pago.id,
     p_monto, v_ant.moneda, p_fecha_aplicacion, v_uid)
  RETURNING * INTO v_ap;
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_ant.organization_id, v_uid, COALESCE(v_email,''), 'aplicar_anticipo_a_factura', 'cxp',
            v_ap.id, 'Aplicación ' || v_ap.id::text,
            jsonb_build_object('anticipo_id', p_anticipo_id, 'factura_id', p_factura_id,
                               'monto', p_monto, 'moneda', v_ant.moneda,
                               'monto_convertido', COALESCE(v_pago.monto_en_moneda_factura, v_monto_convertido),
                               'tc_aplicacion_dof', v_tc_aplicacion,
                               'monto_tc_historico', v_monto_historico,
                               'diferencial_cambiario',
                                 CASE WHEN v_monto_historico IS NULL THEN NULL
                                      ELSE round(COALESCE(v_pago.monto_en_moneda_factura, v_monto_convertido) - v_monto_historico, 4) END,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;
  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('aplicacion_id', v_ap.id, 'pago_id', v_pago.id));
  RETURN v_ap;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date, uuid) TO service_role;
