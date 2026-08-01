ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS sin_comision boolean NOT NULL DEFAULT false;

ALTER TABLE public.embarques
  ADD COLUMN IF NOT EXISTS sin_comision boolean NULL;

COMMENT ON COLUMN public.clientes.sin_comision IS 'Cuenta directa: sus embarques no generan comisión por default.';
COMMENT ON COLUMN public.embarques.sin_comision IS 'NULL = heredar del cliente; true/false = override explícito.';

CREATE OR REPLACE FUNCTION public.resolver_sin_comision(p_embarque_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(e.sin_comision, c.sin_comision, false)
    FROM public.embarques e
    LEFT JOIN public.clientes c ON c.id = e.cliente_id
   WHERE e.id = p_embarque_id
$$;

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

  -- Exclusión explícita de comisión (cliente cuenta directa u override del embarque).
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

  v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
  IF v_pago.moneda::text = 'MXN' THEN
    v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto);
  ELSIF v_tc_pago IS NOT NULL AND v_tc_pago > 0 THEN
    v_cobrado_mxn := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) * v_tc_pago;
  ELSE
    v_cobrado_mxn := public.convertir_a_mxn(
      COALESCE(v_pago.monto_aplicado_factura, v_pago.monto),
      v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
    );
  END IF;

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

  SELECT COALESCE(porcentaje_default, 0) INTO v_pct
    FROM vendedora_config
   WHERE organization_id = v_pago.organization_id
     AND user_id = v_vendedora_id AND activa = true;
  v_pct := COALESCE(v_pct, 0);

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

  v_utilidad := v_ingresos_mxn - v_costos_mxn;
  v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                       THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                       ELSE 0 END;
  v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
  v_nota := CASE
    WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
    WHEN v_tc_usd = 0 OR v_tc_eur = 0 THEN 'Tipos de cambio del embarque incompletos'
    ELSE NULL
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

GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolver_sin_comision(uuid) TO service_role;