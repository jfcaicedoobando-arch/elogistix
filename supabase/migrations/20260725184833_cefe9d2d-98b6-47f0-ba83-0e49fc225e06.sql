-- P13 — dedupe del trigger recalcular_estado_factura:
-- Antes: llamaba a saldo_factura() (SUM pagos + SUM NC) y luego repetía SUM(pagos_factura)
-- para v_pagado. Ahora suma pagos y NC una sola vez y deriva v_saldo localmente.
-- No cambia el resultado observable (mismo estado calculado) ni permisos.

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_total numeric;
  v_pagado numeric;
  v_ncs numeric;
  v_saldo numeric;
  v_vencimiento date;
  v_estado_actual estado_factura;
  v_nuevo_estado estado_factura;
  v_prev_flag text;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado
    INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas
  WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- P13: una sola pasada por pagos_factura y factura_notas_credito.
  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM public.pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = v_factura_id AND deleted_at IS NULL AND estado = 'Aplicada';

  v_saldo := COALESCE(v_total, 0) - v_pagado - v_ncs;

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  RETURN COALESCE(NEW, OLD);
END;
$function$;