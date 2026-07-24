-- Fuente canónica de public.guard_pago_proveedor (dominio cxp).
-- Última migración que la define: 20260723223436 (H6, grants anclados;
-- cuerpo idéntico a FIX-R3-01 / 20260723220718).
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
  v_ncs         numeric;
  v_pagos       numeric;
  v_saldo       numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT moneda, tipo_cambio_usd, COALESCE(total,0)
    INTO v_fact_moneda, v_fact_tc, v_fact_total
    FROM public.proveedor_facturas
    WHERE id = NEW.proveedor_factura_id
    FOR UPDATE;

  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;

  NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);

  IF NEW.moneda = 'MXN'::public.moneda
     AND v_fact_moneda = 'USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;

  -- Saldo disponible para ESTA fila (los demás pagos vivos ya se excluyen abajo).
  SELECT COALESCE(SUM(monto),0) INTO v_ncs
    FROM public.proveedor_notas_credito
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND estado::text = 'Aplicada';

  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_saldo := v_fact_total - v_ncs - v_pagos;

  -- Validación directa (válida para INSERT y UPDATE: v_pagos ya excluye NEW.id).
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
