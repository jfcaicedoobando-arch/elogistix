-- FIX-R2-01 · Guard CxP consolidado (bug de sobrepago aceptado en INSERT).
-- Reemplaza dos triggers BEFORE (conversión + validación) por una sola función
-- que bloquea la factura con FOR UPDATE, convierte primero y valida después.

DROP TRIGGER IF EXISTS tg_pagos_proveedor_no_sobrepago ON public.pagos_proveedor;
DROP TRIGGER IF EXISTS trg_pagos_proveedor_monto_convertido ON public.pagos_proveedor;
DROP FUNCTION IF EXISTS public.tg_pago_proveedor_no_sobrepago();
DROP FUNCTION IF EXISTS public.tg_pagos_proveedor_monto_convertido();

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
  v_delta       numeric;
BEGIN
  -- Soft-deleted rows no requieren revalidación (recalc AFTER se encarga del estado).
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 1) Bloquear factura para evitar carreras (paridad con FIX-R4-04 en CxC).
  SELECT moneda, tipo_cambio_usd, COALESCE(total,0)
    INTO v_fact_moneda, v_fact_tc, v_fact_total
    FROM public.proveedor_facturas
    WHERE id = NEW.proveedor_factura_id
    FOR UPDATE;

  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2) Conversión SIEMPRE primero. Si falta TC, la función interna lanza
  --    LC_PAGO_TC_REQUERIDO / LC_PAGO_CRUCE_NO_SOPORTADO.
  NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);

  -- 3) Diferencial cambiario — misma fórmula que el trigger histórico.
  IF NEW.moneda = 'MXN'::public.moneda
     AND v_fact_moneda = 'USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;

  -- 4) Delta a validar (en INSERT es todo el monto; en UPDATE es la diferencia).
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0) - COALESCE(OLD.monto_en_moneda_factura,0);
  ELSE
    v_delta := COALESCE(NEW.monto_en_moneda_factura,0);
  END IF;

  IF v_delta <= 0 THEN
    RETURN NEW;
  END IF;

  -- 5) Saldo = total − NCs aplicadas − otros pagos vivos.
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

  IF v_delta > v_saldo + 0.005 THEN
    RAISE EXCEPTION
      'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(v_delta,2), round(v_saldo,2)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_pago_proveedor() FROM PUBLIC, anon;
-- La función es SECURITY DEFINER y sólo se invoca vía trigger; no hace falta GRANT explícito.

CREATE TRIGGER trg_pagos_proveedor_guard
  BEFORE INSERT OR UPDATE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.guard_pago_proveedor();

-- Cierre bloque 0.5: grants faltantes.
-- snapshot_cotizacion_al_enviar es SECURITY DEFINER sin REVOKE histórico.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='snapshot_cotizacion_al_enviar' AND pronamespace='public'::regnamespace) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.snapshot_cotizacion_al_enviar() FROM PUBLIC, anon';
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;

-- _calcular_demoras_montos_contenedor tenía REVOKE sin GRANT a service_role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='_calcular_demoras_montos_contenedor' AND pronamespace='public'::regnamespace) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public._calcular_demoras_montos_contenedor(uuid) TO service_role';
  END IF;
EXCEPTION WHEN undefined_function THEN NULL;
END $$;