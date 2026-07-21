
-- Fase S.1 (N-1): guardas de vínculo bbva_movimientos ↔ pagos
--
-- Valida en BD que un movimiento bancario:
--  1) no esté vinculado simultáneamente a un pago de factura y a un pago de proveedor,
--  2) pertenezca a la misma organización que el pago referenciado,
--  3) coincida en moneda con la cuenta bancaria del movimiento y el pago,
--  4) no esté vinculado por más de un pago vivo (índice único parcial).

CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_cuenta_moneda text;
BEGIN
  -- Sólo puede estar vinculado a UN tipo de pago a la vez.
  IF NEW.pago_factura_id IS NOT NULL AND NEW.pago_proveedor_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a un pago de factura y a un pago de proveedor al mismo tiempo'
      USING ERRCODE = 'P0001';
  END IF;

  -- Moneda de la cuenta bancaria del movimiento (para validar contra el pago).
  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
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
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
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
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_movimiento_pago_consistente ON public.bbva_movimientos;
CREATE TRIGGER trg_movimiento_pago_consistente
BEFORE INSERT OR UPDATE OF pago_factura_id, pago_proveedor_id, cuenta_bancaria_id, organization_id
ON public.bbva_movimientos
FOR EACH ROW
EXECUTE FUNCTION public.assert_movimiento_pago_consistente();

-- Índices únicos parciales: un pago no puede estar vinculado por más de un movimiento vivo.
-- bbva_movimientos no tiene deleted_at (movimientos bancarios son inmutables).
CREATE UNIQUE INDEX IF NOT EXISTS uq_bbva_movimientos_pago_factura
  ON public.bbva_movimientos (pago_factura_id)
  WHERE pago_factura_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bbva_movimientos_pago_proveedor
  ON public.bbva_movimientos (pago_proveedor_id)
  WHERE pago_proveedor_id IS NOT NULL;
