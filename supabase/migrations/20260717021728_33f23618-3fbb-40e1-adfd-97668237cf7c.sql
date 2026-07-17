CREATE OR REPLACE FUNCTION public.check_factura_saldo_para_nc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_pagado numeric;
  v_nc_aplicadas numeric;
  v_saldo numeric;
  v_estado text;
BEGIN
  SELECT f.total, f.estado::text
    INTO v_total, v_estado
  FROM public.facturas f
  WHERE f.id = NEW.factura_id;

  IF v_total IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(p.monto_aplicado_factura), 0)
    INTO v_pagado
  FROM public.pagos_factura p
  WHERE p.factura_id = NEW.factura_id
    AND p.deleted_at IS NULL;

  SELECT COALESCE(SUM(nc.monto), 0)
    INTO v_nc_aplicadas
  FROM public.factura_notas_credito nc
  WHERE nc.factura_id = NEW.factura_id
    AND nc.id <> NEW.id
    AND nc.estado = 'Aplicada';

  v_saldo := v_total - v_pagado - v_nc_aplicadas;

  IF v_estado = 'Emitida' AND v_saldo <= 0.01 THEN
    RAISE EXCEPTION 'FACTURA_LIQUIDADA_SIN_NC: La factura ya está liquidada (saldo = %). No se pueden emitir notas de crédito sobre facturas sin saldo pendiente.', v_saldo
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;