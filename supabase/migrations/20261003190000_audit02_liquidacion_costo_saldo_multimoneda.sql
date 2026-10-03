-- Auditoria GUI 02: un pago nominal MXN 100 no liquida una factura USD 100.
-- Derivar la liquidacion del mismo saldo en moneda de factura que usa CxP.
-- Reemision completa, sin backfill ni reparaciones de registros historicos.
CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_concepto(p_concepto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_org_sesion uuid;
  v_pagado boolean;
  v_fecha date;
  v_bypass_prev text;
BEGIN
  IF p_concepto_id IS NULL THEN RETURN; END IF;

  SELECT cc.organization_id INTO v_org
  FROM public.conceptos_costo cc
  WHERE cc.id = p_concepto_id AND cc.deleted_at IS NULL;
  IF v_org IS NULL THEN RETURN; END IF;

  -- Los triggers/backend conservan el contexto de la fila. Una llamada de
  -- usuario no puede sincronizar un costo de otra organizacion.
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NOT NULL OR auth.role() = 'authenticated') THEN
    v_org_sesion := public.current_user_org_id();
    IF v_org_sesion IS NULL THEN
      RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organizacion activa'
        USING ERRCODE = '42501';
    END IF;
    IF v_org_sesion IS DISTINCT FROM v_org THEN RETURN; END IF;
  END IF;

  WITH facturas_vinculadas AS (
    SELECT DISTINCT pf.id, pf.organization_id, pf.moneda
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    WHERE pfc.concepto_costo_id = p_concepto_id
      AND pfc.organization_id = v_org
      AND pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  )
  SELECT COALESCE(BOOL_AND(
           s.saldo IS NOT NULL AND s.saldo <= 0.01
           -- Fail closed ante datos legacy sin importe convertido/TC.
           AND NOT EXISTS (
             SELECT 1 FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL
               AND (pp.organization_id IS DISTINCT FROM v_org
                    OR pp.monto_en_moneda_factura IS NULL))
           AND NOT EXISTS (
             SELECT 1 FROM public.proveedor_notas_credito nc
             WHERE nc.proveedor_factura_id = pf.id AND nc.deleted_at IS NULL
               AND nc.estado = 'Aplicada'
               AND (nc.organization_id IS DISTINCT FROM v_org
                    OR public.monto_pago_en_moneda_factura(
                      nc.monto, nc.moneda::text, nc.tipo_cambio, pf.moneda::text) IS NULL))
         ), false), MAX(ultimo_pago.fecha_pago)
    INTO v_pagado, v_fecha
  FROM facturas_vinculadas pf
  -- Canon CxP: pagos.monto_en_moneda_factura ya conserva el TC del pago o
  -- la conversion DOF de anticipos; las NC solo restan si estan Aplicadas.
  LEFT JOIN public.v_proveedor_facturas_saldo s
    ON s.proveedor_factura_id = pf.id AND s.organization_id = v_org
  LEFT JOIN LATERAL (
    SELECT MAX(pp.fecha_pago) AS fecha_pago
    FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = pf.id
      AND pp.organization_id = v_org AND pp.deleted_at IS NULL
  ) ultimo_pago ON true;

  -- Bypass acotado: solo alrededor del UPDATE de sincronizacion.
  v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), 'off');
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);
    UPDATE public.conceptos_costo
       SET estado_liquidacion = CASE WHEN v_pagado THEN 'Pagado' ELSE 'Pendiente' END::public.estado_liquidacion,
           fecha_pago = CASE WHEN v_pagado THEN v_fecha ELSE NULL END
     WHERE id = p_concepto_id AND organization_id = v_org AND deleted_at IS NULL;
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) TO service_role;
