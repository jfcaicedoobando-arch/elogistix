-- H6 fix: re-aplicar funciones SECURITY DEFINER con REVOKE/GRANT explícitos.
-- Corrige violaciones del auditor en migraciones anteriores no editables.

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

  IF COALESCE(NEW.monto_en_moneda_factura,0) > v_saldo + 0.005 THEN
    RAISE EXCEPTION
      'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(COALESCE(NEW.monto_en_moneda_factura,0),2), round(v_saldo,2)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.guard_pago_proveedor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_pago_proveedor() TO service_role;

CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(
  p_cotizacion_id uuid,
  p_embarque_id uuid,
  p_org uuid,
  p_target_ids uuid[],
  p_conceptos_venta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_costo public.cotizacion_costos%ROWTYPE;
  v_cid   uuid;
  v_venta jsonb;
  v_cant  integer;
  v_total numeric;
  v_pu    numeric;
BEGIN
  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto,
              COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              COALESCE(v_costo.proveedor, ''), p_org);
    ELSE
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto,
                COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                COALESCE(v_costo.proveedor, ''), p_org);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant  := GREATEST(COALESCE((v_venta->>'cantidad')::integer, 1), 1);
        v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0), 2);
        v_pu    := COALESCE((v_venta->>'precio_unitario')::numeric, 0);

        IF ABS(v_total - ROUND(v_cant::numeric * v_pu, 2)) > 0.01 THEN
          v_pu := ROUND(v_total / v_cant::numeric, 6);
        END IF;

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id
        )
        VALUES (
          p_embarque_id,
          v_venta->>'descripcion',
          v_cant,
          v_pu,
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, false),
          v_total,
          p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;