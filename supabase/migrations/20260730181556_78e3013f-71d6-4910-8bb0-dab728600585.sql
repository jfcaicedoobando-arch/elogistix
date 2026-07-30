CREATE OR REPLACE FUNCTION public.guard_estado_factura()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
DECLARE v_pagos_vivos int; v_bypass boolean;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF OLD.estado = 'Cancelada'::estado_factura THEN
    RAISE EXCEPTION 'LC_FAC_REAPERTURA: una factura cancelada no puede reabrirse' USING ERRCODE='P0001';
  END IF;
  IF NEW.estado = 'Cancelada'::estado_factura THEN
    SELECT count(*) INTO v_pagos_vivos FROM public.pagos_factura
      WHERE factura_id=OLD.id AND deleted_at IS NULL;
    IF v_pagos_vivos > 0 THEN
      RAISE EXCEPTION 'LC_FAC_CANCEL_CON_PAGOS: revierta los % pagos vivos antes de cancelar', v_pagos_vivos USING ERRCODE='P0001';
    END IF;
  END IF;
  v_bypass := (current_setting('app.recalc_estado_factura', true) = '1')
              AND (
                COALESCE(auth.role()::text,'') = 'service_role'
                OR current_user = 'postgres'
                OR public.has_role(auth.uid(),'super_admin'::app_role)
              );
  IF NEW.estado IN ('Pagada'::estado_factura,'Parcialmente pagada'::estado_factura,'Vencida'::estado_factura)
     AND NOT v_bypass THEN
    RAISE EXCEPTION 'LC_FAC_ESTADO_CALCULADO: el estado % sólo puede fijarlo el recálculo automático', NEW.estado USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.tg_proforma_eur_no_soportada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.estado_proforma='facturada' AND (OLD.estado_proforma IS DISTINCT FROM 'facturada') THEN
    IF EXISTS (
      SELECT 1 FROM public.conceptos_venta cv
      WHERE cv.proforma_id=NEW.id AND cv.deleted_at IS NULL AND cv.moneda='EUR'::public.moneda
    ) OR EXISTS (
      SELECT 1 FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id=NEW.id AND pcc.deleted_at IS NULL AND pcc.moneda='EUR'::public.moneda
    ) THEN
      RAISE EXCEPTION 'LC_MONEDA_NO_SOPORTADA: la conversión de proformas con conceptos en EUR aún no está soportada'
        USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $function$;