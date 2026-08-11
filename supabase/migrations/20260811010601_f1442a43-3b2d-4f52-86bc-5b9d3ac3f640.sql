-- FIX: pagos a proveedor en embarques Cerrados.
-- La sincronización automática de estado_liquidacion en conceptos_costo es una
-- operación del sistema (no una edición de usuario), por lo que se ejecuta con
-- bypass del candado de cierre. Los importes/conceptos siguen protegidos.

CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_concepto(p_concepto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pagado boolean;
  v_fecha date;
  v_bypass_prev text;
BEGIN
  IF p_concepto_id IS NULL THEN RETURN; END IF;

  SELECT
    EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada')
    AND NOT EXISTS (
      SELECT 1 FROM proveedor_facturas_conceptos pfc
      JOIN proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
      WHERE pfc.concepto_costo_id = p_concepto_id
        AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada'
        AND COALESCE(pf.total, 0) > COALESCE((
          SELECT SUM(pp.monto) FROM pagos_proveedor pp
          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL), 0) + 0.01)
  INTO v_pagado;

  SELECT MAX(pp.fecha_pago) INTO v_fecha
  FROM proveedor_facturas_conceptos pfc
  JOIN pagos_proveedor pp ON pp.proveedor_factura_id = pfc.proveedor_factura_id
  WHERE pfc.concepto_costo_id = p_concepto_id AND pp.deleted_at IS NULL;

  -- Bypass acotado: sólo alrededor del UPDATE de sincronización.
  v_bypass_prev := COALESCE(current_setting('app.bypass_cierre', true), 'off');
  BEGIN
    PERFORM set_config('app.bypass_cierre', 'on', true);

    UPDATE conceptos_costo
       SET estado_liquidacion = CASE WHEN v_pagado THEN 'Pagado' ELSE 'Pendiente' END::estado_liquidacion,
           fecha_pago = CASE WHEN v_pagado THEN v_fecha ELSE NULL END
     WHERE id = p_concepto_id;

    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.bypass_cierre', v_bypass_prev, true);
    RAISE;
  END;
END $function$;

REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_concepto(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.recalcular_estado_liquidacion_factura(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF p_factura_id IS NULL THEN RETURN; END IF;
  FOR r IN
    SELECT DISTINCT concepto_costo_id FROM proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NOT NULL
  LOOP
    PERFORM recalcular_estado_liquidacion_concepto(r.concepto_costo_id);
  END LOOP;
END $function$;

REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_factura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalcular_estado_liquidacion_factura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_factura(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_estado_liquidacion_factura(uuid) TO service_role;