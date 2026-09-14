-- Fuente canónica de public.assert_movimiento_pago_consistente() (N5 · v13.823.386).
-- 1:1 con supabase/migrations/20260914190057_51646384-f9a6-4ce8-9bca-b065da917dc7.sql.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

-- N5 (v13.823.386): el trigger de consistencia comparaba sólo el importe
-- absoluto, así que un cargo podía conciliarse como cobro de cliente y un
-- abono como pago a proveedor. Se exige el sentido bancario:
--   cobro de cliente (pago_factura_id / pago_factura_lote_id) ⇒ abono > 0, cargo = 0
--   salida de dinero (pago_proveedor_id / lote / anticipo)     ⇒ cargo > 0, abono = 0
-- Los traspasos conservan su tratamiento (un cargo en origen y un abono en
-- destino, sin vínculo de pago).
CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_pago_monto numeric;
  v_cuenta_moneda text;
  v_vinculos int;
  v_mov numeric;
  c_tol constant numeric := 1.00; -- tolerancia en la moneda del movimiento
BEGIN
  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_factura_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.traspaso_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor, lote de pago, anticipo o traspaso)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: un cobro de cliente entra a la cuenta (abono), nunca sale.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro de cliente sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;

    -- N11: cobro ⇒ abono en la cuenta.
    v_mov := GREATEST(COALESCE(NEW.abono,0), COALESCE(NEW.cargo,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: un pago a proveedor sale de la cuenta (cargo), nunca entra.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;

    v_mov := GREATEST(COALESCE(NEW.cargo,0), COALESCE(NEW.abono,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > c_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia %)',
        v_mov, v_pago_monto, c_tol
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor_lote
    WHERE id = NEW.pago_proveedor_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_INEXISTENTE: el lote de pago % no existe o está eliminado', NEW.pago_proveedor_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de pago a proveedores también es salida de dinero.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago en lote a proveedores sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_factura_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura_lote
    WHERE id = NEW.pago_factura_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE: el lote de cobro % no existe o está eliminado', NEW.pago_factura_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de cobro pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote de cobro (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de cobro a clientes entra a la cuenta.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro en lote a clientes sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el anticipo a proveedor es salida de dinero.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un anticipo a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_movimiento_pago_consistente() TO authenticated, service_role;
