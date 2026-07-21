-- FIX-08 (sobrepago con NCs) + FIX-23 (lock parent contra concurrencia)
CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_pago()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_estado text;
  v_total numeric;
  v_pagos_otros numeric;
  v_ncs numeric;
  v_saldo_disponible_previo numeric;
  v_saldo_post numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- FIX-23: bloquear la factura padre para serializar pagos concurrentes.
  PERFORM 1 FROM public.facturas WHERE id = NEW.factura_id FOR UPDATE;

  SELECT estado::text, COALESCE(total, 0)
    INTO v_estado, v_total
  FROM public.facturas
  WHERE id = NEW.factura_id;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN
    RAISE EXCEPTION 'LC_PAGO_FACTURA_NO_VIVA: la factura está en estado % y no admite pagos', v_estado
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object('estado_factura', v_estado)::text;
  END IF;

  -- Pagos vivos EXCLUYENDO la fila actual (INSERT o UPDATE del mismo id).
  SELECT COALESCE(SUM(pf.monto_aplicado_factura), 0) INTO v_pagos_otros
  FROM public.pagos_factura pf
  WHERE pf.factura_id = NEW.factura_id
    AND pf.deleted_at IS NULL
    AND pf.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- FIX-08: restar NCs aplicadas (mismo conjunto canónico que public.saldo_factura).
  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = NEW.factura_id
    AND deleted_at IS NULL
    AND estado = 'Aplicada';

  v_saldo_disponible_previo := v_total - v_pagos_otros - v_ncs;
  v_saldo_post := v_saldo_disponible_previo - COALESCE(NEW.monto_aplicado_factura, 0);

  IF v_saldo_post < -0.01 THEN
    RAISE EXCEPTION 'LC_PAGO_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT    = json_build_object(
              'saldo_disponible', v_saldo_disponible_previo,
              'monto_intentado', NEW.monto_aplicado_factura,
              'notas_credito_aplicadas', v_ncs
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.assert_factura_viva_para_pago() IS
'FIX-08/23: valida que el pago no exceda saldo neto (total - pagos vivos - NCs aplicadas) con lock sobre la factura padre para evitar sobrepagos concurrentes.';

-- Mismo tratamiento en CxP: bloquear proveedor_factura padre para evitar sobrepago concurrente.
CREATE OR REPLACE FUNCTION public.check_no_sobrepago_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_saldo numeric;
  v_estado text;
  v_total numeric;
  v_pagos_otros numeric;
  v_ncs numeric;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- FIX-23: lock del padre.
  PERFORM 1 FROM public.proveedor_facturas WHERE id = NEW.proveedor_factura_id FOR UPDATE;

  SELECT estado, COALESCE(total, 0) INTO v_estado, v_total
  FROM public.proveedor_facturas
  WHERE id = NEW.proveedor_factura_id;

  IF v_estado = 'Cancelada' THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_NO_VIVA: la factura de proveedor está cancelada'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(SUM(pp.monto_en_moneda_factura), 0) INTO v_pagos_otros
  FROM public.pagos_proveedor pp
  WHERE pp.proveedor_factura_id = NEW.proveedor_factura_id
    AND pp.deleted_at IS NULL
    AND pp.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.proveedor_notas_credito
  WHERE proveedor_factura_id = NEW.proveedor_factura_id
    AND deleted_at IS NULL
    AND estado IN ('Aplicada');

  v_saldo := v_total - v_pagos_otros - v_ncs - COALESCE(NEW.monto_en_moneda_factura, 0);

  IF v_saldo < -0.01 THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_SOBREPAGO: el pago excede el saldo pendiente'
      USING ERRCODE = 'check_violation',
            HINT = json_build_object(
              'saldo_disponible', v_total - v_pagos_otros - v_ncs,
              'monto_intentado', NEW.monto_en_moneda_factura
            )::text;
  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.check_no_sobrepago_proveedor() IS
'FIX-08/23: valida que el pago al proveedor no exceda saldo neto (total - pagos vivos - NCs aplicadas) con lock sobre la factura padre.';