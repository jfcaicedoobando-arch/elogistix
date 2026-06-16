
-- 1) GRANTs faltantes en tablas de tracking (sin esto, RLS nunca se evalúa
--    para 'authenticated' y los SELECT devuelven 0 filas).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_externo TO authenticated;
GRANT ALL ON public.tracking_externo TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_intentos TO authenticated;
GRANT ALL ON public.tracking_intentos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_links TO authenticated;
GRANT ALL ON public.tracking_links TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_webhook_log TO authenticated;
GRANT ALL ON public.tracking_webhook_log TO service_role;

-- 2) Trigger `recalcular_estado_factura` referencia `facturas.fecha_pago`,
--    columna inexistente. Eliminar esa parte del UPDATE.
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
  v_vencimiento date;
  v_estado_actual estado_factura;
  v_nuevo_estado estado_factura;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual = 'Cancelada' OR v_estado_actual = 'Borrador' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0)
  INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  IF v_pagado >= v_total - 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  UPDATE facturas
  SET estado = v_nuevo_estado,
      updated_at = now()
  WHERE id = v_factura_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
