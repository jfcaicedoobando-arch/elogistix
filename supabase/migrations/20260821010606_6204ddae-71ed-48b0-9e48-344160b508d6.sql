-- Ola 2 · O2.1 y O2.2 — comisiones prorrateadas por embarque y cierre satisfacible.

-- O2.1 · helper de sólo lectura: venta del embarque en MXN menos NC aplicadas.
CREATE OR REPLACE FUNCTION public.venta_embarque_mxn_neta(
  p_embarque_id uuid, p_tc_usd numeric, p_tc_eur numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    COALESCE((
      SELECT SUM(public.convertir_a_mxn(cv.total, cv.moneda::text,
                                        NULLIF(p_tc_usd,0), NULLIF(p_tc_eur,0)))
      FROM public.conceptos_venta cv
      WHERE cv.embarque_id = p_embarque_id AND cv.deleted_at IS NULL), 0)
    - COALESCE((
      SELECT SUM(public.convertir_a_mxn(
               public.nc_aplicadas_en_moneda_factura(f.id), f.moneda::text,
               NULLIF(p_tc_usd,0), NULLIF(p_tc_eur,0)))
      FROM public.facturas f
      WHERE f.embarque_id = p_embarque_id AND f.deleted_at IS NULL
        AND f.estado NOT IN ('Cancelada','Sustituida','Borrador')), 0)
  , 0)::numeric;
$function$;

REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.venta_embarque_mxn_neta(uuid, numeric, numeric) TO service_role;

-- O2.1 · reporte de sólo lectura: embarques con proporción devengada > 1.
CREATE OR REPLACE FUNCTION public.comisiones_sobre_devengadas()
RETURNS TABLE (
  embarque_id uuid,
  facturas bigint,
  utilidad_prorrateada_mxn numeric,
  comision_mxn numeric,
  proporcion_total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cd.embarque_id,
         COUNT(DISTINCT cd.factura_id) AS facturas,
         ROUND(SUM(cd.utilidad_prorrateada_mxn), 2),
         ROUND(SUM(cd.comision_mxn), 2),
         ROUND(SUM(cd.monto_cobrado_mxn) / NULLIF(
           public.venta_embarque_mxn_neta(cd.embarque_id,
             (SELECT tipo_cambio_usd FROM public.embarques e WHERE e.id = cd.embarque_id),
             (SELECT tipo_cambio_eur FROM public.embarques e WHERE e.id = cd.embarque_id)), 0), 4)
  FROM public.comisiones_devengadas cd
  WHERE cd.embarque_id IS NOT NULL
    AND cd.estado <> 'Cancelada'
    AND cd.deleted_at IS NULL
    AND (cd.organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role))
  GROUP BY cd.embarque_id
  HAVING SUM(cd.monto_cobrado_mxn) > 1.01 * COALESCE(NULLIF(
           public.venta_embarque_mxn_neta(cd.embarque_id,
             (SELECT tipo_cambio_usd FROM public.embarques e WHERE e.id = cd.embarque_id),
             (SELECT tipo_cambio_eur FROM public.embarques e WHERE e.id = cd.embarque_id)), 0), 0)
  ORDER BY 4 DESC;
$function$;

REVOKE ALL ON FUNCTION public.comisiones_sobre_devengadas() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comisiones_sobre_devengadas() FROM anon;
GRANT EXECUTE ON FUNCTION public.comisiones_sobre_devengadas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.comisiones_sobre_devengadas() TO service_role;

-- O2.1 · prorrateo por venta del embarque (antes: total de UNA factura).
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
  v_req_usd boolean := false;
  v_req_eur boolean := false;
  v_cliente_id uuid;
  -- Ola 2 · O2.1: denominador del prorrateo = venta del embarque neta de NC.
  v_venta_neta_mxn numeric(14,2);
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
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'cobrado_mxn',
      'No se pudo valuar lo cobrado a MXN', SQLSTATE, SQLERRM);
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

    -- Ola 2 · O2.1: la utilidad es del EMBARQUE, así que la proporción también
    -- debe medirse contra la venta del embarque (neta de notas de crédito).
    -- Antes se dividía entre `factura.total`: dos facturas vivas del mismo
    -- embarque sumaban proporción 2 → comisión doble.
    v_venta_neta_mxn := public.venta_embarque_mxn_neta(
      v_embarque_id, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0));

    IF COALESCE(v_venta_neta_mxn, 0) > 0 THEN
      -- Tope 1: nunca se comisiona más del 100% de la utilidad del embarque.
      v_proporcion := LEAST(v_cobrado_mxn / v_venta_neta_mxn, 1);
    ELSE
      v_proporcion := 0;
    END IF;

    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN (v_req_usd AND v_tc_usd = 0) OR (v_req_eur AND v_tc_eur = 0)
        THEN 'Tipos de cambio del embarque incompletos'
      WHEN COALESCE(v_venta_neta_mxn, 0) <= 0
        THEN 'Venta del embarque pendiente de captura'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := 0;
    v_comision_mxn := 0;
    v_nota := 'Comisión en 0: pendiente de recálculo (ver cola)';
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'utilidad_embarque',
      'No se pudo calcular la utilidad del embarque', SQLSTATE, SQLERRM);
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

REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO service_role;

-- O2.2 · la regla de cierre `comisiones_definitivas` era imposible de cumplir:
-- `definitiva` sólo se pone en TRUE dentro de `cerrar_embarque`, DESPUÉS de
-- validar. Ahora bloquea lo que de verdad importa: comisiones devengadas con
-- nota de pendiente, o filas en la cola de recálculo del embarque.
DO $ola2$
DECLARE
  v_src text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc WHERE proname = 'validar_cierre_embarque'
  ORDER BY oid DESC LIMIT 1;

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'Ola 2: no existe validar_cierre_embarque';
  END IF;

  IF position('AND definitiva=false' IN v_src) = 0 THEN
    RAISE EXCEPTION 'Ola 2: no se encontró la regla definitiva=false en validar_cierre_embarque';
  END IF;

  v_new := replace(v_src,
$old$  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas
   WHERE embarque_id=p_embarque_id AND definitiva=false;$old$,
$new$  -- Ola 2 · O2.2: se bloquea por pendientes REALES (nota de pendiente o
  -- cola de recálculo), no por la bandera `definitiva` que sólo se marca al
  -- cerrar (círculo vicioso que obligaba a "forzar" todos los cierres).
  SELECT COUNT(*) INTO v_com_count FROM comisiones_devengadas cd
   WHERE cd.embarque_id=p_embarque_id
     AND cd.estado='Devengada' AND cd.deleted_at IS NULL
     AND cd.nota IS NOT NULL;
  IF EXISTS (SELECT 1 FROM comisiones_recalculo_pendiente crp
              WHERE crp.embarque_id=p_embarque_id
                AND COALESCE(crp.resuelto, false) = false) THEN
    v_com_count := v_com_count + 1;
  END IF;$new$);

  IF v_new = v_src THEN
    RAISE EXCEPTION 'Ola 2: el bloque de comisiones_definitivas no coincidió textualmente';
  END IF;

  EXECUTE v_new;
END
$ola2$;

REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO service_role;