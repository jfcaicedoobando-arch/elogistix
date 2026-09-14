-- Fuente canónica de public.guard_pago_proveedor (dominio cxp).
-- Última migración que la define: 20260825000700 (BL-15, diferencia
-- cambiaria también en el cruce pago USD → factura MXN).
-- D4 (v13.823.382): la fecha del pago se valida aquí (requerida, no futura y
-- no anterior a la emisión de la factura) y NO cuenta como "sólo metadato",
-- así que un UPDATE directo tampoco puede moverla fuera de rango.
-- Grants anclados (H6, migración 20260723223436).
-- Regla: cualquier cambio a esta función debe actualizar este archivo
-- en el mismo PR (ver supabase/schema/README.md).

CREATE OR REPLACE FUNCTION public.guard_pago_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc     numeric;
  v_fact_total  numeric;
  v_fact_estado public.estado_proveedor_factura;
  v_fact_deleted timestamptz;
  v_fact_emision date;
  v_hoy_mx date := GREATEST((now() AT TIME ZONE 'America/Mexico_City')::date, CURRENT_DATE);
  v_ncs         numeric;
  v_pagos       numeric;
  v_saldo       numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio_usd IS NOT DISTINCT FROM OLD.tipo_cambio_usd
      -- D4: la fecha NO es metadato; cambiarla vuelve a pasar por las
      -- validaciones de abajo.
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  -- D4: fecha requerida y nunca futura (fecha de negocio México).
  IF NEW.fecha_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: captura la fecha del pago'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.fecha_pago > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del pago (%) no puede ser futura', NEW.fecha_pago
      USING ERRCODE = '22023';
  END IF;

  SELECT moneda, tipo_cambio_usd, COALESCE(total,0), estado, deleted_at, fecha_emision
    INTO v_fact_moneda, v_fact_tc, v_fact_total, v_fact_estado, v_fact_deleted, v_fact_emision
    FROM public.proveedor_facturas
    WHERE id = NEW.proveedor_factura_id
    FOR UPDATE;

  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_fact_estado = 'Cancelada'::public.estado_proveedor_factura
     OR v_fact_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_FACTURA_NO_VIVA: la factura de proveedor está % y no admite pagos',
      CASE WHEN v_fact_deleted IS NOT NULL THEN 'en la papelera' ELSE 'Cancelada' END
      USING ERRCODE = '23514';
  END IF;

  -- D4: nunca antes de la emisión de la factura (mismo canon que el lote y
  -- que programar_pago_proveedor).
  IF v_fact_emision IS NOT NULL AND NEW.fecha_pago < v_fact_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del pago (%) es anterior a la emisión de la factura (%)',
      NEW.fecha_pago, v_fact_emision
      USING ERRCODE = '22023';
  END IF;

  -- F3: los pagos directos siguen exigiendo captura MXN<->USD. Cuando el pago
  -- nace de una APLICACIÓN DE ANTICIPO, la RPC ya valuó con paridad DOF del
  -- día (soporta EUR y cruces); el guard respeta esa valuación.
  BEGIN
    NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
      NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);
  EXCEPTION WHEN OTHERS THEN
    IF COALESCE(NEW.es_anticipo_aplicado, false) THEN
      NEW.monto_en_moneda_factura := public.convertir_monto_dof(
        NEW.monto, NEW.moneda::text, v_fact_moneda::text,
        COALESCE(NEW.fecha_pago, CURRENT_DATE));
    ELSE
      RAISE;
    END IF;
  END;

  IF NEW.moneda = 'MXN'::public.moneda
     AND v_fact_moneda = 'USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSIF NEW.moneda = 'USD'::public.moneda
     AND v_fact_moneda = 'MXN'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;

  -- F4: misma conversión canónica que la vista v_proveedor_facturas_saldo.
  SELECT COALESCE(SUM(
           public.monto_pago_en_moneda_factura(
             nc.monto, nc.moneda::text, nc.tipo_cambio, v_fact_moneda::text)), 0)
    INTO v_ncs
    FROM public.proveedor_notas_credito nc
   WHERE nc.proveedor_factura_id = NEW.proveedor_factura_id
     AND nc.deleted_at IS NULL
     AND nc.estado::text = 'Aplicada';

  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_saldo := v_fact_total - v_ncs - v_pagos;

  IF COALESCE(NEW.monto_en_moneda_factura,0) > v_saldo + 0.005 THEN
    RAISE EXCEPTION
      'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(COALESCE(NEW.monto_en_moneda_factura,0),2), round(v_saldo,2)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- Grants anclados (H6, migración 20260723223436):
REVOKE ALL ON FUNCTION public.guard_pago_proveedor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_pago_proveedor() TO service_role;
