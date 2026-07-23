-- Fuente canónica de public.recalcular_estado_factura
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid; v_total numeric; v_pagado numeric; v_saldo numeric;
  v_vencimiento date; v_estado_actual estado_factura; v_nuevo_estado estado_factura;
  v_prev_flag text;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_saldo := public.saldo_factura(v_factura_id);

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  -- v13.308.3 — Marcar recálculo autorizado para que guard_estado_factura
  -- permita fijar Pagada / Parcialmente pagada / Vencida. Se usa
  -- is_local=true (SET LOCAL) para restringir el efecto a esta
  -- transacción/función.
  v_prev_flag := current_setting('app.recalc_estado_factura', true);
  PERFORM set_config('app.recalc_estado_factura', '1', true);

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  PERFORM set_config('app.recalc_estado_factura', COALESCE(v_prev_flag, ''), true);

  RETURN COALESCE(NEW, OLD);
END;
$function$
 name:recalcular_estado_factura schema:public;
