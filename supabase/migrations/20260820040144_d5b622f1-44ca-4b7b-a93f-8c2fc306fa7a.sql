CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid;
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric;
  v_tc_factura numeric;
  -- BL-17(b): TCs realmente requeridos por las monedas de los conceptos.
  v_req_usd boolean := false;
  v_req_eur boolean := false;
  v_cliente_id uuid;
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;

  IF v_embarque_id IS NOT NULL AND public.resolver_sin_comision(v_embarque_id) THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0,
           nota = 'Embarque excluido de comisión', updated_at = now()
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT vendedora_id, COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO v_vendedora_id, v_tc_usd, v_tc_eur
    FROM embarques WHERE id = v_embarque_id;

  BEGIN
    -- BL-01: monto_aplicado_factura está en moneda de la FACTURA y
    -- pagos_factura.tipo_cambio es el factor pago→factura (no el TC a MXN).
    -- Valuar lo cobrado desde la moneda de la factura con el TC del
    -- documento; nunca multiplicar por el factor pago→factura.
    v_tc_factura := NULLIF(v_factura.tipo_cambio, 0);
    IF v_pago.monto_aplicado_factura IS NOT NULL THEN
      IF v_factura.moneda::text = 'MXN' THEN
        v_cobrado_mxn := v_pago.monto_aplicado_factura;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto_aplicado_factura,
          v_factura.moneda::text,
          COALESCE(v_tc_factura, NULLIF(v_tc_usd, 0)),
          COALESCE(v_tc_factura, NULLIF(v_tc_eur, 0))
        );
      END IF;
    ELSIF v_pago.moneda::text = 'MXN' THEN
      v_cobrado_mxn := v_pago.monto;
    ELSE
      -- Sin monto_aplicado: el pago manda. El lote CxC (RBD-08) guarda en
      -- tipo_cambio el TC real a MXN; si no aplica, TCs del embarque.
      v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
      IF v_tc_pago IS NOT NULL AND v_tc_pago > 1 THEN
        v_cobrado_mxn := v_pago.monto * v_tc_pago;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto,
          v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_cobrado_mxn := 0;
  END;

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  -- Ola 3.1: excepción por embarque > excepción por cliente > default.
  v_cliente_id := v_factura.cliente_id;
  v_pct := COALESCE(public.resolver_porcentaje_comision(
             v_pago.organization_id, v_vendedora_id, v_cliente_id, v_embarque_id), 0);

  BEGIN
    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cv.total, cv.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_ingresos_mxn
      FROM conceptos_venta cv
     WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cc.monto, cc.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_costos_mxn
      FROM conceptos_costo cc
     WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

    -- BL-17(b): monedas presentes en los conceptos del embarque; la nota de
    -- TC incompleto sólo aplica a los TCs que de verdad se necesitan.
    SELECT COALESCE(bool_or(m.moneda::text = 'USD'), false),
           COALESCE(bool_or(m.moneda::text = 'EUR'), false)
      INTO v_req_usd, v_req_eur
      FROM (
        SELECT moneda FROM conceptos_venta
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
        UNION ALL
        SELECT moneda FROM conceptos_costo
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
      ) m;

    v_utilidad := v_ingresos_mxn - v_costos_mxn;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN (v_req_usd AND v_tc_usd = 0) OR (v_req_eur AND v_tc_eur = 0)
        THEN 'Tipos de cambio del embarque incompletos'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := 0;
    v_nota := 'Tipos de cambio del embarque incompletos: comisión en 0, pendiente de recalcular';
  END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$;

REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO service_role;